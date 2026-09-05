/**
 * Performance budgets. One file, on purpose.
 *
 * HOW TO CHANGE A NUMBER IN HERE
 * ------------------------------
 * Raise a budget only with the reason written next to it and the date. A budget
 * quietly raised to make a red build green is how performance dies: nothing ever
 * regresses, because the line moves every time it would have been crossed. If a
 * page legitimately needs more bytes, that is a real answer and it belongs in
 * the comment. "The audit was failing" is not.
 *
 * A SINGLE SAMPLE IS NOT EVIDENCE
 * -------------------------------
 * Operator ruling, 2026-09-04, and it is the first thing to read here.
 *
 * Lighthouse on this site moves a route's LCP by up to 740ms between
 * consecutive runs of the same build. One measurement therefore says almost
 * nothing: it is a draw from a distribution roughly a third as wide as the
 * budget itself. No number in this file may be set, raised, or defended on the
 * strength of one run, and no red run may be dismissed as noise on the strength
 * of one green one. Three samples, and the median.
 *
 * THE CEILINGS BELOW PREDATE THE STATISTIC NOW JUDGING THEM
 * ---------------------------------------------------------
 * This is a real caveat and not a footnote, so it sits above the numbers.
 *
 * Until 2026-09-04 perf-audit judged each route on the BEST of three runs. The
 * ceilings below were calibrated against that, and were themselves derived from
 * the worst observed run plus headroom, which made the gate forgiving twice
 * over: a generous line, tested with an optimistic statistic.
 *
 * perf-audit now judges the MEDIAN of three, which is stricter. Every ceiling
 * in this file was therefore set under a regime that is no longer in force, and
 * a route sitting close to its ceiling may now fail where it always passed.
 *
 * WHEN THAT HAPPENS IT IS A FINDING, NOT A CALIBRATION ERROR. The route is
 * genuinely slower than the line the firm drew for it, and it always was; the
 * old statistic simply could not see it. The two honest answers are to make the
 * route faster, or for the operator to re-derive the ceiling deliberately, with
 * the reason and the date, under the rule at the top of this file. Quietly
 * nudging a number so a red run goes green is neither.
 *
 * WHERE THESE NUMBERS CAME FROM
 * -----------------------------
 * Measured on 2026-08-31 against the production build served locally, on the
 * throttled mobile profile in scripts/perf-audit.mjs (4x CPU, 1.6Mbps, 150ms
 * RTT), after the font and map work on fix/performance. Each route was measured
 * five times and the budget set from the worst observed run plus headroom, not
 * from the median, because a gate calibrated on the median fails one run in two.
 *
 * THE METRIC CEILINGS ARE THE OPERATOR'S, NOT LIGHTHOUSE'S
 * --------------------------------------------------------
 * LCP 2.0s, CLS 0.05, TBT 200ms. All three are stricter than Google's "good"
 * thresholds (2.5s, 0.1, 200ms), which is deliberate: the site currently sits
 * well inside them and the gate exists to keep it there, not to notice after it
 * has already fallen out.
 *
 * LOCALHOST MEASURES SLOWER THAN THE LIVE HOST, AND THE GATE HAS TWO CEILINGS
 * ---------------------------------------------------------------------------
 * This is the part most likely to be read as fudging, so here is the data.
 *
 * The same commit, measured on the live host, produced LCP between 1555 and
 * 2901ms across the eight sampled templates. Served from next start on this
 * machine it produced 2919 to 3183ms. Localhost is FASTER on TTFB by two orders
 * of magnitude (2ms against 175ms), so the server is not the cause.
 *
 * What is established: next start negotiates gzip while the edge serves brotli,
 * and the same document weighed 15,835 bytes locally against 13,906 live, about
 * 14 percent more on the wire. Under simulated throttling more bytes means a
 * later paint.
 *
 * What is NOT established: 14 percent more bytes does not account for a gap of
 * more than a second. Something else in the local serving path contributes and
 * this pass did not isolate it. That is written down rather than papered over
 * with a confident guess, because the next person to look at these numbers
 * deserves to know the explanation is partial.
 *
 * The consequence for the gate: one ceiling cannot serve both environments. A
 * 2.0s ceiling applied to localhost fails a site that is genuinely inside 2.0s
 * where users are, and a 3.4s ceiling applied to the live host would not catch a
 * real regression. So there are two, and which applies is decided by the host
 * being measured, not by a flag somebody can set to make a build pass.
 *
 * REMOTE is the operator's specification and is the one that matters.
 * LOCAL is empirical, set from measurement on this harness, and exists so the
 * gate can run in the suite before anything is deployed.
 */

/**
 * Metric ceilings, applied to every route in the set.
 *
 * CLS and TBT do not differ by environment: they are computed from layout and
 * main thread work, not from transfer, and both measured identically local and
 * live (CLS 0.000 everywhere, TBT under 25ms everywhere).
 */
export const METRIC_BUDGETS = {
  remote: {
    /** The operator's specification. Stricter than Google's 2500ms "good". */
    lcp: 2000,
    cls: 0.05,
    tbt: 200,
  },
  local: {
    /*
     * Empirical. The worst best-of-run LCP measured on this harness after the
     * font and map work was 3015ms on the homepage, with the next worst at
     * 2938ms. 3400 leaves roughly 385ms of headroom over the worst template.
     *
     * Raising this is how the gate stops working. If a route cannot make 3400ms
     * here, the honest first question is what changed in the page, not whether
     * the number is too strict.
     */
    lcp: 3400,
    cls: 0.05,
    tbt: 200,
  },
};

/**
 * Per template transferred byte budgets, in kilobytes.
 *
 * Keyed by the route measured. One route per template rather than every route,
 * because the templates are what change and a per route budget list would be
 * forty entries that nobody maintains.
 */
/*
 * THE HOMEPAGE CARRIES ITS OWN LCP CEILING, RE-DERIVED 2026-09-04
 * ===============================================================
 *
 * Operator ruling, 2026-09-04. 3600ms, which is the page's measured steady
 * state plus roughly 6%, matching the headroom this file's header says the
 * original budgets were set with.
 *
 * THE CEILING WAS RE-DERIVED WHILE THE GATE WAS GREEN.
 * ----------------------------------------------------
 * This is the part that matters most, because the rule at the top of this file
 * exists to stop the opposite. Nothing was failing when this number changed.
 * The homepage was crossing 0 of 8 medians against the old 3400ms ceiling. It
 * moved because 12ms of margin is not a gate: the page's own run to run range
 * is 75ms, so any unrelated change costing five milliseconds would have turned
 * the suite red for a reason having nothing to do with that change. A red that
 * means nothing is how a suite stops being read.
 *
 * WHAT WAS TRIED FIRST, BEFORE ANY NUMBER MOVED
 * ---------------------------------------------
 * The homepage was crossing 2 of 4 medians at 3400. The investigation found:
 *
 *   The LCP element is NOT the map. It is the hero paragraph. The map sits at
 *   y=721 on a 390 wide viewport, at the fold, and never paints as the largest
 *   element. It was merely heavy.
 *
 *   The county geometry was carried TWICE in the document: 67,689 bytes as
 *   rendered markup, and 66,336 of those bytes again inside the React flight
 *   payload, which is how a server rendered tree ships.
 *
 * So the shared geometry is now emitted as ONE pre serialised string rather
 * than 254 React elements, in TexasCountyMap. The rendered markup is BYTE
 * IDENTICAL before and after, 56,974 bytes and 254 paths, verified by
 * comparison rather than by eye. That mattered: the map is server rendered ON
 * PURPOSE, because this page's claim is that the firm covers all 254 counties,
 * and the counties have to be in the HTML for anything that does not run
 * JavaScript. Rendering it client side would have saved more and removed the
 * thing worth keeping.
 *
 * That change moved the homepage from 2 of 4 crossings to 0 of 8.
 *
 * The saving was only 991 gzipped bytes, about 5ms of transfer, which cannot
 * explain a 146ms drop. The mechanism is most likely main thread rather than
 * wire: 254 fewer element descriptors to parse and reconcile, under a 4x CPU
 * slowdown that multiplies exactly that.
 *
 * THE EVIDENCE, EIGHT INDEPENDENT MEDIANS OF THREE
 * ------------------------------------------------
 *   3314, 3313, 3388, 3385, 3383, 3384, 3385, 3385
 *   min 3313, median 3384.5, max 3388, range 75
 *   steady state, runs 3 to 8: 3383 to 3388
 *   crossings at 3400: 0 of 8, worst margin 12ms
 *   crossings at 3600: 0 of 8, worst margin 212ms
 *
 * Runs 1 and 2 came in about 70ms faster and look like warm up. From run 3 the
 * page lands inside a 5ms band, every time.
 *
 * WHY THIS IS PER ROUTE AND NOT THE GLOBAL CEILING
 * ------------------------------------------------
 * METRIC_BUDGETS.local.lcp applies to all ten routes, and the other nine
 * measure between 2866 and 3311. Raising the global number would have handed
 * them 200 to 700ms of slack they have not earned, which is loosening nine
 * gates to fix one. The global ceiling stays at 3400 and only the page that
 * needed re-deriving carries its own.
 *
 * Option 2, reducing the coordinate precision of the geometry, was investigated
 * and NOT done. It was conditional on the first change failing to clear, and it
 * did not fail.
 */
export const ROUTE_BUDGETS = [
  {
    name: "homepage",
    path: "/",
    /** Re-derived 2026-09-04. See the block immediately above this list. */
    lcp: 3600,
    // Carries the county map once, shared with the hero, plus the lead form.
    // The heaviest document on the site by some distance.
    kb: 620,
  },
  { name: "service", path: "/services/windstorm-wpi-8", kb: 560 },
  {
    name: "coverage hub",
    path: "/coverage",
    // The 254 county map inline. This is the byte budget most likely to be
    // argued with, and the map is not negotiable: see the note at the top of
    // src/components/map/TexasCountyMap.tsx on why it is not colour coded and
    // why its geometry is generated rather than drawn.
    kb: 600,
  },
  { name: "region", path: "/coverage/coastal-bend", kb: 560 },
  // The hub template is a different page shape from its cluster pages: a card
  // grid rather than prose. It was missing from this list, and an injection test
  // that put a blocking task on it passed green because nothing measured it.
  { name: "windstorm hub", path: "/windstorm", kb: 540 },
  { name: "windstorm cluster", path: "/windstorm/before-work-begins", kb: 540 },
  { name: "proximity cluster", path: "/structural-engineer", kb: 540 },
  { name: "insights post", path: "/insights/texas-pe-license-lookup", kb: 540 },
  { name: "careers hub", path: "/careers", kb: 580 },
  {
    name: "application stepper",
    path: "/careers/professional-engineer",
    // The only route that legitimately ships a second client bundle: the
    // multi step application flow, which is code split and loads only here.
    kb: 560,
  },
];
