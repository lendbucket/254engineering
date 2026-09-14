/**
 * The performance gate.
 *
 *   BASE_URL=http://localhost:3225 node scripts/perf-audit.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * seo-audit runs Lighthouse for the SEO category only, deliberately. That left
 * loading, bundle size, image weight, and layout stability with no gate at all,
 * which means every regression in them shipped silently. The site measures well
 * today. This is here so it still does in six months.
 *
 * WHAT IT ASSERTS
 * ---------------
 * Per route: LCP, CLS, and TBT against the ceilings in perf-budgets.mjs, and
 * total transferred bytes against a per template budget where one is
 * calibrated. Budgets and ceilings live in that file with the reasoning.
 *
 * WHICH ROUTES, AND THE SESSIONS THEY NEED
 * ----------------------------------------
 * The subjects come from scripts/lib/surfaces.mjs, the declared inventory, plus
 * ROUTE_BUDGETS for the public templates it does not walk. Guarded screens are
 * measured UNDER A REAL SESSION, made by the same probes every other browser
 * audit uses. Two refusals carry the weight, and both exist because this gate
 * measured zero portal screens until 2026-09-14 while a report said otherwise:
 * a guarded route with no session FAILS rather than recording, and a route that
 * did not stay on the path asked for is COULD NOT TELL rather than a pass.
 *
 * LIGHTHOUSE VARIES RUN TO RUN, AND THE GATE IS BUILT FOR THAT
 * ------------------------------------------------------------
 * Measured on this site: the same route, same profile, same build, moved by up
 * to 740ms of LCP between consecutive runs. A gate calibrated on a single run is
 * a coin toss that wakes somebody up at two in the morning.
 *
 * So each route is measured RUNS times and judged on its MEDIAN.
 *
 * IT USED TO BE JUDGED ON ITS BEST RUN, AND THAT WAS WRONG
 * -------------------------------------------------------
 * Operator ruling, 2026-09-04. The argument for the best run was that it is
 * "what this page is capable of on this machine" and that a real regression
 * moves the floor. Both halves are true and it is still the wrong statistic for
 * a gate, because the minimum of three samples is decided by a single lucky
 * run. That is the same thing as calibrating on one sample, which is the
 * practice the paragraph above exists to reject, wearing a disguise.
 *
 * The median is representative. One fast sample cannot carry a route past its
 * ceiling, and one slow sample cannot fail it either.
 *
 * THIS IS STRICTER, NOT MORE FORGIVING, AND THAT IS THE POINT
 * -----------------------------------------------------------
 * Best of three fails only when all three samples exceed the ceiling. The
 * median fails when two of three do. Moving to the median therefore raises
 * every measured number and can turn a route that has always passed into one
 * that does not. A route that fails at the median is a real finding and is to
 * be reported as one, never absorbed by moving the line it crossed.
 *
 * The full spread is printed either way, so a page that is merely getting
 * noisier is visible before it starts failing.
 *
 * AND THERE IS A THIRD VERDICT, BECAUSE TWO WERE NOT ENOUGH
 * ---------------------------------------------------------
 * Operator ruling, 2026-09-07. The paragraph above says a page getting noisier
 * is visible before it starts failing, and that turned out to be optimistic:
 * the noise arrived and the failure arrived with it, in the same run.
 *
 * /careers/professional-engineer measured 2934ms with a 3ms spread on one suite
 * run and 3454ms with a 521ms spread an hour later, same machine, nothing
 * touching that route in between. The ceiling is 3400ms, so the failing margin
 * was 54ms against noise ten times its size. Both readings were reported with
 * complete confidence and neither was worth having.
 *
 * So LCP can now come back COULD NOT TELL: neither a pass nor a failure, when
 * the ceiling falls inside the observed range and that range is wider than a
 * stated fraction of the ceiling. The rule and the reasoning are in
 * scripts/lib/perf-verdict.mjs, which is a separate module precisely so it can
 * be exercised, since this file launches Chrome the moment it is imported.
 *
 * THE CEILING DOES NOT MOVE, AND UNSTABLE IS NOT A HIDING PLACE
 * -------------------------------------------------------------
 * Both halves of that are load bearing. Nothing here widens a budget: the
 * doctrine three paragraphs up still holds, and a route that fails at a
 * trustworthy median is still a real finding. And a genuinely slow page cannot
 * shelter in the new verdict, because a route whose FASTEST sample is over the
 * ceiling fails outright and never reaches it. What lands in COULD NOT TELL is
 * only the genuinely ambiguous case.
 *
 * A route that keeps landing there is telling you this profile cannot resolve
 * it. That is a finding about the instrument, and it is answered by measuring
 * on a deployment rather than by moving the line.
 *
 * THE THROTTLING PROFILE IS WRITTEN OUT RATHER THAN INHERITED
 * -----------------------------------------------------------
 * 4x CPU, 1.6Mbps, 150ms RTT, stated explicitly. Lighthouse's mobile default is
 * currently the same, and if that default ever moves, the budgets in
 * perf-budgets.mjs would silently start measuring something else.
 */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";
import {
  METRIC_BUDGETS,
  ROUTE_BUDGETS,
  REMOTE_LCP_TARGET,
  budgetKbFor,
  KNOWN_OVER_BUDGET,
} from "./perf-budgets.mjs";
/*
 * Pass, fail, and could not tell. In its own module so it can be exercised:
 * this file launches Chrome on load, so anything defined here is unreachable to
 * a test. See the header of scripts/lib/perf-verdict.mjs, and the bucket walk,
 * which taught the same lesson the same week.
 */
import { verdictFor, stabilityLimit } from "./lib/perf-verdict.mjs";
import { allPages, measurableSurfaces } from "./lib/surfaces.mjs";
import {
  createProbe,
  createPartnerProbe,
  createCustomerProbe,
  destroyProbes,
  destroyPartnerProbes,
  destroyCustomerProbes,
} from "./lib/portal-probe.mjs";
import { checkVerdictLogic } from "./proofs/perf-verdict-fires-where-it-should.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const RUNS = Number(process.env.PERF_RUNS || 3);

/*
 * A SUBSTRING FILTER, FOR WORKING ON ONE ROUTE AND FOR PROVING THE REFUSALS.
 *
 * It narrows what is MEASURED and deliberately does not touch the coverage
 * check, so nobody can make the surfaces assertion pass by measuring one page.
 * A filtered run says so in its own output and is never a board run.
 */
const ONLY = process.env.PERF_ONLY || "";

/*
 * THE SESSION CAN BE SUPPRESSED, AND THE ONLY REASON IS TO PROVE THE REFUSAL.
 *
 * Set it and every cookie is withheld. A guarded route must then FAIL naming the
 * missing session rather than measuring the login page it is redirected to. That
 * is the injection for this file, and it is here rather than in a patch script
 * because the thing being proved is a refusal, and a refusal somebody has to
 * hand-edit the file to exercise is a refusal nobody exercises.
 */
const NO_SESSION = process.env.PERF_NO_SESSION === "1";

/*
 * ============================================================================
 * TWO CADENCES, BECAUSE A FORTY MINUTE BOARD IS A BOARD NOBODY RUNS.
 * ============================================================================
 *
 * Operator ruling, 2026-09-14, from a measured figure rather than a guess. The
 * authenticated set is 50 screens; at three runs each the whole gate takes
 * 25 minutes against the public set's four, and it would turn a twenty minute
 * board into forty.
 *
 * In the operator's words: a gate nobody runs is the shape this whole phase is
 * about. So the public templates stay on every board, and the authenticated set
 * runs ON DEMAND AND BEFORE ANY MERGE:
 *
 *   PERF_SCOPE=all npx tsx scripts/perf-audit.mjs
 *
 * THE DEFERRAL IS NEVER A PASS, and that is the part that matters. A board run
 * reports the authenticated set as COULD NOT TELL, naming how many screens were
 * not measured and the command that measures them. A green line saying nothing
 * about the portal is what this file printed for months while measuring zero
 * portal screens, and it is exactly what must not come back.
 */
const SCOPE =
  process.env.PERF_SCOPE === "all" || process.argv.includes("--all") ? "all" : "public";

/*
 * Which ceilings apply is decided by the host being measured, not by a flag
 * somebody can set to make a red build green. A localhost build is judged
 * against the empirical local ceiling; anything else is a real deployment and
 * gets the operator's specification. The measurements behind the two numbers,
 * and the part of the gap this pass could not explain, are in perf-budgets.mjs.
 */
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE);
const CEILINGS = IS_LOCAL ? METRIC_BUDGETS.local : METRIC_BUDGETS.remote;

const BASE_SETTINGS = {
  formFactor: "mobile",
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
  throttlingMethod: "simulate",
  throttling: {
    rttMs: 150,
    throughputKbps: 1600,
    cpuSlowdownMultiplier: 4,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1600 * 0.9,
    uploadThroughputKbps: 750,
  },
};

/*
 * A SESSION RIDES WITH THE REQUEST, WHICH IS THE WHOLE REASON THIS FILE CHANGED.
 *
 * Lighthouse drives its own Chrome and does not share Playwright's context, so
 * the probe's cookie is handed over as a header rather than as browser state.
 * `extraHeaders` is applied to every request the page makes, which is what a
 * portal screen needs: the document and the route handlers it calls.
 */
function settingsFor(cookie) {
  if (!cookie) return BASE_SETTINGS;
  return { ...BASE_SETTINGS, extraHeaders: { Cookie: cookie } };
}

/*
 * THE GATE CHECKS ITS OWN DECISION RULE BEFORE IT MEASURES ANYTHING.
 *
 * Fourteen cases, pure, in under a second, run on every invocation rather than
 * on the day somebody remembers the proof file exists. If the rule that decides
 * pass, fail and could not tell is broken, every number below it is worthless,
 * so this aborts rather than reporting a board nobody should read.
 */
{
  const { failed, total } = checkVerdictLogic(false);
  if (failed.length) {
    console.log("");
    console.log(`THE VERDICT RULE IS BROKEN: ${failed.length} of ${total} cases fail.`);
    for (const f of failed) console.log(`  ${f}`);
    console.log("");
    console.log("Nothing was measured. A gate whose decision rule is wrong reports nothing useful.");
    console.log("  node scripts/proofs/perf-verdict-fires-where-it-should.mjs");
    process.exit(1);
  }
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** Recorded like a check, and counted separately: it is not a pass. */
const recUnstable = (name, note) => out.push({ name, ok: true, unstable: true, note });
const kb = (bytes) => Math.round(bytes / 1024);

/*
 * ============================================================================
 * WHAT THIS GATE MEASURES, AND WHY IT IS NO LONGER A HARDCODED LIST
 * ============================================================================
 *
 * Until 2026-09-14 this file iterated ROUTE_BUDGETS and nothing else: ten
 * routes, every one a public marketing page, driven with no session.
 *
 * PORTAL ROUTES MEASURED: ZERO. No authenticated screen on this platform had
 * ever had its performance measured, and the Phase 13 Section 2 report asserted
 * the opposite in writing, which one command disproved.
 *
 * It is the /portal/queue defect from the other end. That screen reached 38,744
 * pixels tall past a green board because nothing measured its height. This was a
 * GATE whose subject list silently excluded an entire surface.
 *
 * So the subjects now come from the DECLARED INVENTORY, the same idiom every
 * other browser audit follows, and a measurable surface that contributes no
 * measured route fails the board rather than being quietly absent.
 *
 * ROUTE_BUDGETS keeps its job and loses its monopoly: it is the per template
 * BYTE budget table for the public site, calibrated route by route in
 * perf-budgets.mjs. Authenticated screens have no byte budget yet and are NOT
 * given an invented one; their bytes are measured and printed so a budget can be
 * set from evidence rather than from a guess.
 */
const PUBLIC_SUBJECTS = ROUTE_BUDGETS.map((r) => ({ ...r, session: "none", probe: null }));

/*
 * THE WHOLE INVENTORY, not only the guarded half.
 *
 * The order flow is a measurable surface whose routes need no session, and
 * taking only the guarded pages would leave it measured by nothing while the
 * coverage check below went red about it. Measuring it is the better answer
 * than reporting that nobody measures it: those two routes carry a catalogue
 * and a checkout and are exactly the kind of page that grows quietly.
 */
const INVENTORY_SUBJECTS = allPages().map((page) => ({
  path: page.path,
  name: page.name,
  session: page.session,
  probe: page.probe,
  role: page.role,
  surface: page.surface,
  /* No kb: nothing outside the public site has a calibrated byte budget. */
}));

const SUBJECTS =
  SCOPE === "all" ? [...PUBLIC_SUBJECTS, ...INVENTORY_SUBJECTS] : [...PUBLIC_SUBJECTS];

/*
 * THE SURFACES IDIOM, APPLIED TO PERFORMANCE.
 *
 * A surface that exists and is measured by nothing is exactly the hole this
 * change closes, so it is asserted rather than assumed. Adding a surface without
 * measuring it is a red board.
 */
{
  const measured = new Set(
    SUBJECTS.map((x) => x.surface).filter(Boolean),
  );
  /* The public site's routes come from the sitemap and are budgeted by hand, so
   * it is represented by ROUTE_BUDGETS rather than by the walker. */
  measured.add("public");
  const missing = measurableSurfaces()
    .map((sf) => sf.key)
    .filter((key) => !measured.has(key));
  if (SCOPE === "all") {
    rec(
      `every measurable surface contributes a measured route (${measured.size} surfaces, ${SUBJECTS.length} routes)`,
      missing.length === 0,
      missing.length
        ? `measured by nothing: ${missing.join(", ")}. A surface the performance gate cannot see is a surface whose screens can be any weight at all.`
        : "",
    );
  } else {
    /*
     * THE DEFERRED SET IS REPORTED AS NOT MEASURED, ON EVERY BOARD.
     *
     * COULD NOT TELL rather than a pass, for the reason UNREACHABLE IS NOT
     * FAILED gives: it exits zero and it says loudly that it did not run. The
     * count is asserted so the deferral can never quietly become an empty set,
     * which is how a skip turns into a silence.
     */
    rec(
      `the deferred authenticated set is not empty (${INVENTORY_SUBJECTS.length} screens)`,
      INVENTORY_SUBJECTS.length > 0,
      INVENTORY_SUBJECTS.length === 0
        ? "the inventory yielded no authenticated screens, so the line below is a deferral of nothing"
        : "",
    );
    recUnstable(
      `${INVENTORY_SUBJECTS.length} authenticated screens across ${
        new Set(INVENTORY_SUBJECTS.map((x) => x.surface)).size
      } surfaces were NOT MEASURED on this run`,
      "the board measures the public templates only, by ruling, because the whole gate takes 25 minutes. These screens are measured on demand and BEFORE ANY MERGE: PERF_SCOPE=all npx tsx scripts/perf-audit.mjs",
    );
  }
}

/*
 * THE SESSIONS. One probe per principal, made once and reused across every
 * route that needs it, then destroyed in teardown.
 *
 * A probe that cannot be created is NOT a reason to measure its routes anyway.
 * See the refusal in the loop: measuring a guarded route with no session
 * measures the login page under that route's name.
 */
/*
 * KEYED BY PRINCIPAL AND ROLE, BECAUSE THREE PORTAL ROUTES ARE NOT THE ADMIN'S.
 *
 * The inventory declares `roleFor`: /portal/review and /portal/protocols belong
 * to the engineer, /portal/certification to the field technician. The first
 * version of this change made ONE staff probe, an admin, and measured all three
 * with it. Lighthouse returned no LCP, no CLS and no TBT at all, and the gate
 * reported three screens failing every ceiling with a median of Infinity.
 *
 * That would have been reported as three broken portal screens. It was the
 * measurement using the wrong person. mobile-audit has keyed its sessions by
 * role since it was written, for exactly this reason.
 */
const sessions = {};
const sessionErrors = {};

/** The principal a route needs, as one key: "staff:engineer", "customer:". */
const sessionKeyOf = (route) => `${route.session}:${route.role ?? ""}`;
const probesMade = { staff: false, partner: false, customer: false };

{
  const needed = NO_SESSION || SCOPE !== "all"
    ? []
    : [
        ...new Set(
          INVENTORY_SUBJECTS.filter((x) => x.session !== "none").map((x) =>
            sessionKeyOf(x),
          ),
        ),
      ];
  for (const key of needed) {
    const [kind, role] = key.split(":");
    try {
      if (kind === "staff") {
        const probe = await createProbe(BASE, role, "perf-audit");
        probesMade.staff = true;
        sessions[key] = probe?.cookie ? `eng_ops=${probe.cookie}` : null;
      } else if (kind === "partner") {
        const probe = await createPartnerProbe(BASE, "perf-audit");
        probesMade.partner = true;
        sessions[key] = probe?.cookie ? `eng_partner=${probe.cookie}` : null;
      } else if (kind === "customer") {
        const probe = await createCustomerProbe(BASE, "perf-audit");
        probesMade.customer = true;
        sessions[key] = probe?.cookie ? `eng_customer=${probe.cookie}` : null;
      }
    } catch (err) {
      sessionErrors[key] = String(err?.message ?? err).split(String.fromCharCode(10))[0];
    }
  }
}

/*
 * ============================================================================
 * THE DYNAMIC SUBJECT, BUILT RATHER THAN INVENTED.
 * ============================================================================
 *
 * `routesOf` skips dynamic segments on purpose, because probing one means
 * inventing an id. That is right for a walker and it means the trade pricing
 * screen, `/portal/accounts/[id]/pricing`, is measured by nothing: it is the
 * screen Phase 13 Section 2 shipped and the one the merge condition names.
 *
 * An invented uuid would render a not-found page, and measuring THAT under the
 * pricing screen's name is the same defect as measuring the login page under
 * it. So the subject is CONSTRUCTED: a demonstration client and account, made
 * here, measured, and superseded in teardown.
 *
 * It is `is_demo` so no figure counts it, and the account is superseded rather
 * than deleted because 0048 refuses DELETE on an account: a record of what
 * somebody was charged outlives the account.
 */
const built = { accountId: null, clientId: null };
if (SCOPE === "all" && sessions["staff:admin"] && !NO_SESSION) {
  try {
    const { auditClient } = await import("./lib/db-target.mjs");
    const db = auditClient("perf-audit", { neverProduction: true });
    if (db) {
      /*
       * ====================================================================
       * ONE STABLE SUBJECT, FOUND OR MADE, AND NEVER TORN DOWN.
       * ====================================================================
       *
       * The first version created a fresh client and account per run and tried
       * to remove both afterwards. It could not, and it DISCARDED THE ERROR.
       * 0048 refuses DELETE on an account, so the account was superseded
       * instead, and the client could then never be deleted either, because the
       * superseded account still references it under ON DELETE RESTRICT.
       *
       * Seven runs left seven permanent client and account pairs on development
       * before anything counted them. That is precisely the defect the 0048
       * teardown lesson already records, committed again by code written after
       * reading it, and it is the argument for a fixture that needs no teardown
       * rather than one whose teardown is careful.
       *
       * So the subject is found by name and created only if absent. It is
       * is_demo, so no figure counts it, and it persists deliberately the way
       * seed-field-demo's records do.
       */
      const PROBE_NAME = "Perf Probe Pricing Co";
      const { data: existing } = await db
        .from("eng_customer_accounts")
        .select("id, client_id, eng_clients!inner(name)")
        .eq("eng_clients.name", PROBE_NAME)
        .is("superseded_at", null)
        .limit(1)
        .maybeSingle();

      let client = existing ? { id: existing.client_id } : null;
      let account = existing ? { id: existing.id } : null;

      if (!account) {
        const madeClient = await db
          .from("eng_clients")
          .insert({
            kind: "organization",
            name: PROBE_NAME,
            email: "perf.pricing@audit-probe.invalid",
            status: "active",
            is_demo: true,
          })
          .select("id")
          .single();
        client = madeClient.data;
        if (client?.id) {
          const madeAccount = await db
            .from("eng_customer_accounts")
            .insert({ site: "254", client_id: client.id, status: "active", billing_mode: "card" })
            .select("id")
            .single();
          account = madeAccount.data;
        }
      }

      if (client?.id) {
        built.clientId = client.id;
        if (account?.id) {
          built.accountId = account.id;
          SUBJECTS.push({
            path: `/portal/accounts/${account.id}/pricing`,
            name: "portal: accounts/[id]/pricing",
            session: "staff",
            probe: "createProbe",
            role: "admin",
            surface: "portal",
          });
        }
      }
    }
  } catch (err) {
    console.error(`  could not build the pricing subject: ${String(err?.message ?? err)}`);
  }
}

/*
 * THE SUBJECT HAD TO BE BUILT, SO ITS ABSENCE IS A FAILURE RATHER THAN A GAP.
 *
 * A run that quietly measured 62 routes instead of 63 would report green while
 * the one screen the merge condition names went unmeasured, which is the exact
 * shape this whole change exists to remove.
 */
if (SCOPE === "all" && !NO_SESSION) {
  rec(
    "the trade pricing screen has a subject to measure",
    Boolean(built.accountId),
    built.accountId
      ? `/portal/accounts/${built.accountId}/pricing`
      : "no probe account could be built, so the screen Phase 13 Section 2 shipped is measured by nothing",
  );
}

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

const rows = [];

const MEASURED = ONLY ? SUBJECTS.filter((r) => r.path.includes(ONLY)) : SUBJECTS;

if (ONLY) {
  console.error(`  PERF_ONLY=${ONLY}: measuring ${MEASURED.length} of ${SUBJECTS.length} routes. NOT a board run.`);
  /*
   * A FILTER THAT MATCHES NOTHING IS NOT A PASS.
   *
   * Caught on this file's own first injection run: a mangled filter selected
   * zero routes and the gate reported "PASS: 1 checks across 0 templates",
   * which is the vacuous green this repository keeps finding, produced by the
   * change that was written to close one. The count is asserted rather than
   * trusted, exactly as the sitemap walk's was.
   */
  rec(
    `the filter PERF_ONLY=${ONLY} selected routes to measure (${MEASURED.length})`,
    MEASURED.length > 0,
    MEASURED.length === 0
      ? "it matched nothing, so everything below this line is a green over an empty set. On Git Bash a leading slash is rewritten into a Windows path: use PERF_ONLY=portal/clients rather than /portal/clients."
      : "",
  );
}
if (NO_SESSION) {
  console.error("  PERF_NO_SESSION=1: every cookie withheld. Guarded routes must REFUSE.");
}

for (const route of MEASURED) {
  /*
   * ==========================================================================
   * A MEASUREMENT TAKEN WITHOUT A SESSION FAILS. IT DOES NOT RECORD.
   * ==========================================================================
   *
   * Operator ruling, 2026-09-14, and it is the failure this whole change came
   * from. An unauthenticated request to a portal route is REDIRECTED to the
   * login screen, which answers 200 and is fast and light. Measuring it would
   * record the login page's weight under the pricing screen's name: a green
   * that is not merely vacuous but actively wrong, because it would be cited.
   *
   * So a guarded route with no session is a FAIL naming the probe that could
   * not be made. It is never skipped, because a skip is a route nobody notices
   * is unmeasured, which is how this gate came to measure zero portal screens.
   */
  const cookie = route.session === "none" ? null : sessions[sessionKeyOf(route)];
  if (route.session !== "none" && !cookie) {
    rec(
      `${route.name}: measured under a real session`,
      false,
      `no ${route.session}${route.role ? ` (${route.role})` : ""} session was available${
        sessionErrors[sessionKeyOf(route)] ? `: ${sessionErrors[sessionKeyOf(route)]}` : ""
      }. REFUSING to measure, because an unauthenticated request to ${route.path} is redirected and would record the login page's weight under this route's name.`,
    );
    rows.push({ ...route, failed: true });
    continue;
  }

  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      const r = await lighthouse(
        `${BASE}${route.path}`,
        { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
        { extends: "lighthouse:default", settings: settingsFor(cookie) },
      );
      const a = r.lhr.audits;
      const landed = r.lhr.finalDisplayedUrl ?? r.lhr.finalUrl ?? "";
      const summary = {};
      for (const item of a["resource-summary"]?.details?.items ?? []) {
        summary[item.resourceType] = item.transferSize;
      }
      runs.push({
        landed,
        lcp: a["largest-contentful-paint"]?.numericValue ?? Infinity,
        cls: a["cumulative-layout-shift"]?.numericValue ?? Infinity,
        tbt: a["total-blocking-time"]?.numericValue ?? Infinity,
        bytes: summary.total ?? Infinity,
        summary,
      });
    } catch (err) {
      runs.push({ error: String(err.message).split("\n")[0] });
    }
  }

  const ok = runs.filter((r) => !r.error);
  if (ok.length === 0) {
    rec(`${route.name}: measured`, false, runs[0]?.error ?? "no successful run");
    rows.push({ ...route, failed: true });
    continue;
  }

  /*
   * ==========================================================================
   * A ROUTE THAT REDIRECTED IS COULD NOT TELL. IT IS NEVER A PASS.
   * ==========================================================================
   *
   * Operator ruling, 2026-09-14. A session can be rejected or expire mid run,
   * and the symptom is indistinguishable from a fast page: the login screen
   * loads quickly and would sail under every ceiling.
   *
   * This is deliberately NOT a fail. A failure says the page is too slow, and
   * that is a claim about the page; what happened here is that the page was
   * never measured. COULD NOT TELL is the honest third answer and the one this
   * gate already carries for noise.
   */
  /*
   * ANY departure from the requested path counts, not only a landing on a login
   * screen. A redirect to a dashboard, a not-found, or a tenant chooser is the
   * same defect: the numbers describe a page nobody asked about. Comparing the
   * path subsumes the login case rather than enumerating the ways to leave.
   */
  const landedPathOf = (value) => {
    try {
      return new URL(value).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return null;
    }
  };
  const wanted = route.path.replace(/\/+$/, "") || "/";
  const bounced = ok.filter((r) => {
    const landedPath = r.landed ? landedPathOf(r.landed) : null;
    return landedPath !== null && landedPath !== wanted;
  });

  if (bounced.length) {
    recUnstable(
      `${route.name}: NOT MEASURED, the request did not stay on this route`,
      `asked for ${route.path} and landed on ${
        (() => {
          try {
            return new URL(bounced[0].landed).pathname;
          } catch {
            return bounced[0].landed;
          }
        })()
      } on ${bounced.length} of ${ok.length} runs. Whatever was measured is not this screen, so no number from it is reported. A session that is rejected looks exactly like a fast page.`,
    );
    rows.push({ ...route, failed: true });
    continue;
  }

  /*
   * MEDIAN per metric, and the spread, so noise is visible.
   *
   * Each metric is taken independently rather than picking one "median run" and
   * reading every metric off it. A run can be fast to paint and heavy on the
   * wire, so a single representative run would report a bytes figure that no
   * ceiling was ever calibrated against. Per metric is what the budgets mean.
   */
  const medianOf = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const median = {
    lcp: medianOf(ok.map((r) => r.lcp)),
    cls: medianOf(ok.map((r) => r.cls)),
    tbt: medianOf(ok.map((r) => r.tbt)),
    bytes: medianOf(ok.map((r) => r.bytes)),
  };
  /*
   * Spread is the full observed RANGE, slowest minus fastest, which is what it
   * always meant. It is deliberately not measured from the median: a spread
   * reported relative to the median would understate the noise by about half,
   * and this number exists to make noise visible.
   */
  const spread = {
    lcp: Math.max(...ok.map((r) => r.lcp)) - Math.min(...ok.map((r) => r.lcp)),
    bytes: Math.max(...ok.map((r) => r.bytes)) - Math.min(...ok.map((r) => r.bytes)),
  };
  const summary = ok[0].summary;

  rows.push({ ...route, median, spread, summary, runs: ok.length, samples: ok.map((r) => ({ lcp: r.lcp, cls: r.cls, tbt: r.tbt, bytes: r.bytes })) });

  /*
   * A route may carry its OWN lcp ceiling, and one does. Everything else is
   * judged against the shared one, so re-deriving a number for the page that
   * needed it does not quietly loosen the other nine. The reasoning for the one
   * override is in perf-budgets.mjs above ROUTE_BUDGETS.
   */
  const lcpCeiling = route.lcp ?? CEILINGS.lcp;

  /*
   * LCP is the only metric that gets the three state verdict, because it is the
   * only one whose noise has ever been comparable to its margin. CLS and TBT
   * measure in the single digits against ceilings of 0.05 and 200ms, and bytes
   * do not vary between runs of the same build at all. Giving them a stability
   * rule they cannot exercise would be a check that never fires.
   */
  const lcpSamples = ok.map((r) => r.lcp);
  const lcpVerdict = verdictFor(lcpSamples, lcpCeiling);
  const lcpNote = `${route.path}, median of ${ok.length}, spread ${Math.round(spread.lcp)}ms${
    route.lcp ? ", its own ceiling" : ""
  }`;

  if (lcpVerdict === "unstable") {
    recUnstable(
      `${route.name}: LCP ${Math.round(median.lcp)}ms against ${lcpCeiling}ms, NOT STABLE ENOUGH TO GATE ON`,
      `${lcpNote}. The range ${Math.round(Math.min(...lcpSamples))} to ${Math.round(
        Math.max(...lcpSamples),
      )}ms straddles the ceiling and is wider than ${Math.round(
        stabilityLimit(lcpCeiling),
      )}ms, so this run cannot say. Measure on a deployment.`,
    );
  } else {
    rec(
      `${route.name}: LCP ${Math.round(median.lcp)}ms within ${lcpCeiling}ms`,
      lcpVerdict === "pass",
      lcpVerdict === "fail" && Math.min(...lcpSamples) > lcpCeiling
        ? `${lcpNote}. Every sample was over, so this is not noise.`
        : lcpNote,
    );
  }
  rec(
    `${route.name}: CLS ${median.cls.toFixed(3)} within ${CEILINGS.cls}`,
    median.cls <= CEILINGS.cls,
    route.path,
  );
  rec(
    `${route.name}: TBT ${Math.round(median.tbt)}ms within ${CEILINGS.tbt}ms`,
    median.tbt <= CEILINGS.tbt,
    route.path,
  );
  /*
   * BYTES ARE GATED ONLY WHERE A BUDGET WAS CALIBRATED.
   *
   * The public templates have one, route by route, derived from measurement and
   * argued in perf-budgets.mjs. Authenticated screens have none, and inventing
   * one tonight would be a number nobody measured pretending to be a ruling.
   * The figure is recorded so a budget can be set from evidence.
   */
  /*
   * THE BYTE BUDGET, from the shell plus delta ruling of 2026-09-14 for the
   * authenticated surfaces and from ROUTE_BUDGETS for the public templates.
   *
   * A route with a KNOWN_OVER_BUDGET entry still FAILS. The entry is not a
   * suppression: it carries the reason the red is already known, so the next
   * reader does not rediscover it, and removing the entry when the cause is
   * fixed is the point of having it.
   */
  const budget = budgetKbFor(route);
  const known = KNOWN_OVER_BUDGET[route.path];
  if (typeof budget === "number") {
    const within = kb(median.bytes) <= budget;
    rec(
      `${route.name}: ${kb(median.bytes)}KB within ${budget}KB budget`,
      within,
      within
        ? route.path
        : known
          ? `${route.path}. KNOWN AND UNEXPLAINED since ${known.since}: ${known.reason}`
          : route.path,
    );
  } else {
    console.error(`  ${route.name}: ${kb(median.bytes)}KB, no byte budget set for this template`);
  }
  console.error(`  measured ${route.path}`);
}

try {
  await chrome.kill();
} catch {
  /* chrome-launcher cannot always remove its temp dir on Windows */
}

/*
 * TEARDOWN. Every probe this run made, removed, and the sweep is broader than
 * the ids created so a crashed earlier run is cleaned up too.
 *
 * Guarded by what was actually MADE rather than by what was needed, because
 * destroying probes for a principal this run never created would sweep away a
 * concurrent audit's, and a teardown that removes somebody else's fixture is
 * worse than one that leaves its own.
 */
/*
 * THE PRICING SUBJECT IS NOT TORN DOWN, AND THAT IS THE FIX RATHER THAN AN
 * OMISSION. It is found by name and reused; see the block that builds it. The
 * version that tore it down could not, discarded the error, and left seven
 * permanent client and account pairs on development across seven runs.
 */
if (built.accountId) {
  console.error(`  the pricing subject persists by design: account ${built.accountId}`);
}

for (const [kind, made] of Object.entries(probesMade)) {
  if (!made) continue;
  try {
    if (kind === "staff") await destroyProbes("perf-audit");
    if (kind === "partner") await destroyPartnerProbes("perf-audit");
    if (kind === "customer") await destroyCustomerProbes("perf-audit");
  } catch (err) {
    console.error(`  teardown of the ${kind} probe failed: ${String(err?.message ?? err)}`);
  }
}

console.log("================ PERFORMANCE ================");
console.log(`${BASE}, 4x CPU, 1.6Mbps, 150ms RTT, MEDIAN of ${RUNS} runs`);
console.log(
  `ceilings: ${IS_LOCAL ? "local" : "remote"} profile, LCP ${CEILINGS.lcp}ms, CLS ${CEILINGS.cls}, TBT ${CEILINGS.tbt}ms\n`,
);
console.log("  median values. (spread) is the full observed range, slowest minus fastest.");
console.log("  LCP ms  (spread)   CLS    TBT ms   total KB / budget   HTML   JS  font   img  route");
for (const r of rows) {
  if (r.failed) {
    console.log(`  measurement failed: ${r.path}`);
    continue;
  }
  const s = (k) => String(kb(r.summary[k] ?? 0)).padStart(4);
  console.log(
    `  ${String(Math.round(r.median.lcp)).padStart(6)}  ${`(+${Math.round(r.spread.lcp)})`.padStart(8)}  ${r.median.cls
      .toFixed(3)
      .padStart(5)}  ${String(Math.round(r.median.tbt)).padStart(6)}   ${String(kb(r.median.bytes)).padStart(
      8,
    )} / ${String(budgetKbFor(r) ?? "none").padEnd(5)}  ${s("document")}  ${s("script")}  ${s("font")}  ${s("image")}  ${r.path}`,
  );
}

/*
 * THE RAW SAMPLES, OPT IN, AND THEY CHANGE NO VERDICT.
 *
 * PERF_SAMPLES=<path> writes every individual run to a file. Nothing above
 * reads it back and no ceiling consults it: this is a dump of what was
 * measured, added so a caller can ask a question the printed table cannot
 * answer.
 *
 * The question it was added for is "worst of three", which the overnight sweep
 * asks for and which the table genuinely cannot supply: the table prints the
 * MEDIAN and the SPREAD, and median plus spread does not reconstruct the
 * maximum.
 *
 * AND THE GATE IS STILL JUDGED ON THE MEDIAN. That is the operator's ruling of
 * 2026-09-04 and this does not touch it. Reporting the slowest sample beside
 * the median is a second view of the same data; changing which statistic a
 * ceiling is applied to would be changing what the board enforces, and doing
 * that quietly inside a reporting flag is exactly the move the ruling was made
 * against. If the worst of three should gate, that is a ruling, not an
 * environment variable.
 */
if (process.env.PERF_SAMPLES) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    process.env.PERF_SAMPLES,
    JSON.stringify(
      {
        base: BASE,
        runs: RUNS,
        judgedOn: "median, which is what the ceilings gate; the samples are for reporting only",
        ceilings: CEILINGS,
        rows: rows.map((r) => ({
          path: r.path,
          name: r.name,
          failed: r.failed ?? false,
          median: r.median,
          spread: r.spread,
          samples: r.samples ?? [],
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nraw samples written to ${process.env.PERF_SAMPLES} (reporting only, no verdict reads it)`);
}

console.log("\n=== RESULT ===");
for (const r of out) {
  const label = r.unstable ? "COULD NOT TELL" : r.ok ? "PASS" : "FAIL";
  console.log(`  ${label}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}

const failed = out.filter((r) => !r.ok);
const unstable = out.filter((r) => r.unstable);
console.log("");

/*
 * UNSTABLE IS REPORTED LOUDLY AND DOES NOT FAIL THE RUN.
 *
 * That is the ruling and it is the right trade, but it has one edge worth
 * naming rather than discovering: a page that is genuinely slow AND always
 * noisy would report this forever and never fail. It cannot hide here, because
 * a route whose FASTEST sample is over the ceiling fails outright and never
 * reaches this state. What lands here is only the genuinely ambiguous case,
 * where the ceiling sits inside the observed range.
 *
 * A route that keeps landing here is telling you the local profile cannot
 * resolve it, which is a finding about the instrument and is answered by
 * measuring on a deployment, not by widening the ceiling.
 */
if (unstable.length) {
  console.log(`${unstable.length} measurement(s) were too unstable to gate on:`);
  for (const r of unstable) console.log(`  ${r.name}`);
  console.log("");
  console.log("These are neither passes nor failures. The ceiling has not moved and the page");
  console.log("has not been absolved. This machine could not resolve the margin, which is a");
  console.log("fact about the measurement. Measure on a deployment:");
  console.log("");
  console.log("  BASE_URL=https://254engineering.com PERF_RUNS=5 npx tsx scripts/perf-audit.mjs");
  console.log("");
}

/*
 * THE TARGET, REPORTED BESIDE THE GATE AND NEVER ENFORCED AS ONE.
 *
 * Operator ruling, 2026-09-07, when the two were separated: the gap between
 * what the site does and what the operator wants it to do stays visible rather
 * than being absorbed by a ceiling it can pass.
 *
 * This is the only place in the suite where a number is printed that cannot
 * turn the board red, and that is deliberate. It is a target. Enforcing it from
 * this measuring position is what produced eight COULD NOT TELL verdicts in a
 * row, because the instrument's resolution is wider than the distance between
 * the target and the pages.
 */
if (!IS_LOCAL && rows.some((r) => !r.failed)) {
  const measured = rows.filter((r) => !r.failed);
  const meeting = measured.filter((r) => r.median.lcp <= REMOTE_LCP_TARGET);

  console.log("");
  console.log(`AGAINST THE ${REMOTE_LCP_TARGET}ms TARGET, which is not a gate and cannot fail this run:`);
  console.log("");
  for (const r of measured) {
    const over = Math.round(r.median.lcp) - REMOTE_LCP_TARGET;
    console.log(
      `  ${(over <= 0 ? "meets " : "over  ").padEnd(7)}${String(Math.round(r.median.lcp)).padStart(5)}ms  ${
        over <= 0 ? `${String(-over).padStart(4)}ms under` : `${String(over).padStart(4)}ms over `
      }  ${r.path}`,
    );
  }
  console.log("");
  console.log(
    `  ${meeting.length} of ${measured.length} routes meet the target at the median. The gate is ${CEILINGS.lcp}ms and is a different number for a reason: see perf-budgets.mjs.`,
  );
}

if (failed.length === 0) {
  const solid = out.length - unstable.length;
  console.log(
    `PASS: ${solid} checks across ${rows.length} templates${
      unstable.length ? `, and ${unstable.length} that could not be decided` : ""
    }.`,
  );
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("Budgets are in scripts/perf-budgets.mjs. Raise one only with the reason recorded.");
  process.exitCode = 1;
}
