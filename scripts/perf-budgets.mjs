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
export const ROUTE_BUDGETS = [
  {
    name: "homepage",
    path: "/",
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
