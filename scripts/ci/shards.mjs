/**
 * THE CLOUD BOARD'S SHARDS. Operator ruling, 2026-10-22: 254's boards move to
 * GitHub-hosted runners, the 61 audits run as parallel jobs that each fit a
 * standard runner, and audits that create fixtures on the shared development
 * database must not collide.
 *
 * WHY THE SPLIT IS BY WHAT AN AUDIT WRITES, NOT BY HOW LONG IT TAKES
 * -----------------------------------------------------------------
 * Every probe sweep here clears the whole probe DOMAIN rather than only the ids
 * it made (destroyProbes, by design, so a crashed run is cleaned up too). Two
 * runners creating probes at once would therefore delete each other's live
 * accounts mid-check, and the failure would read as a defect in a screen. So
 * every audit that writes to development, or reads state another audit writes,
 * is in ONE shard, `writers`, and that shard takes its turn on the database
 * across every run of the workflow (scripts/ci/dev-db-turn.mjs). The other
 * shards touch no database and run beside it freely.
 *
 * Unique probe prefixes per job would let the writers split too. That changes
 * the sweep in every probe helper, which is a change to fixtures the board
 * depends on, so it is a follow-up for a ruling rather than part of this move.
 *
 * THE DECLARATION IS CHECKED AGAINST THE RUNNER, NOT AGAINST ITSELF. A shard
 * list is a second account of which audits exist, and a second account drifts.
 * `shardProblems` is handed the runner's own phase arrays and refuses unless
 * every declared audit is in exactly one shard and every shard member is a
 * declared audit. A 62nd audit added to the runner and to no shard fails every
 * shard job naming it, rather than going unmeasured in the cloud.
 *
 * `writes` decides one more thing: only the writer shard tears down queue rows,
 * because a reader shard's before-and-after snapshot would include rows the
 * writer shard enqueued beside it, and deleting those would be removing rows it
 * did not create.
 */
export const SHARDS = {
  /* Phase zero, no database, no browser except email-audit's. */
  static: {
    writes: false,
    audits: [
      "db-guard-audit", "migration-audit", "schema-ledger-audit", "project-accountability-audit",
      "map-markup-audit", "role-cast-audit", "backlog-audit", "surface-audit", "protocol-run-audit",
      "turnaround-audit", "price-book-audit", "accounts-audit", "intake-audit", "partner-audit",
      "jobs-audit", "observability-audit", "token-audit", "portal-voice-audit", "files-audit",
      "dispatch-audit", "onboarding-audit", "review-audit", "comms-audit", "money-audit",
      "stripe-webhook-audit", "order-audit", "registry-audit", "email-audit",
      /* Robert, 2026-10-25: no database, no server; guide-dates-audit needs the full history the checkout fetches. */
      "citation-audit", "guide-dates-audit",
    ],
  },
  /*
   * ON WINDOWS, BECAUSE THE VERBATIM CHECK IS A CHECK AGAINST ONE EXTRACTOR.
   * Found by the first cloud run, 2026-10-22: protocol-registry-audit passes
   * here with pdftotext 4.00 (xpdf, as Git for Windows ships it) and fails 11 of
   * 149 on Ubuntu's poppler, which emits checkbox glyphs and dash forms xpdf
   * does not. xpdf 4.06, the only version still published, differs from 4.00
   * on five of the nine protocol PDFs in how it orders table cells. So the
   * transcriptions agree with xpdf 4.00 and with nothing else tried, and this
   * shard runs where that binary is: a Windows runner's Git for Windows. It
   * prints the version it found, and needs no server.
   */
  documents: {
    writes: false,
    server: false,
    audits: ["protocol-registry-audit"],
  },
  /* Phase one against the shared server, public pages and source, no database. */
  pages: {
    writes: false,
    audits: [
      "coverage-audit", "placeholder-audit", "voice-audit", "cta-audit", "seo-audit",
      "security-audit", "asset-audit", "soc2-audit",
    ],
  },
  /* Phase two, each starting its own server, no database. */
  gate: {
    writes: false,
    audits: ["compliance-audit", "launch-audit"],
  },
  /* Everything that writes to development or reads what another audit wrote. */
  writers: {
    writes: true,
    audits: [
      "proofs-audit", "trade-pricing-audit", "queue-audit", "bulk-audit",
      "forms-audit", "mfa-audit", "sister-intake-audit", "roles-audit", "mobile-overflow-audit",
      "native-audit", "messaging-audit", "perf-audit", "v10-layout-audit", "reporting-audit",
      "demo-audit", "dashboards-audit", "dashboard-speed-audit", "retention-audit",
      "break-glass-audit", "doors-audit", "mobile-audit", "contrast-audit",
    ],
  },
};

/**
 * Audits whose cloud verdict is shown and does not gate. EMPTY SINCE THE
 * CALIBRATION, operator ruling of 2026-10-22: perf-audit was informational
 * here while its budgets, set on the operator's PC, were unproven on a 4-vCPU
 * runner. Three clean main runs (39822941996, 39844926908, 39844942722) each
 * passed 81 checks with no FAIL and no NOT STABLE, the tightest route at
 * 223ms under its ceiling, so it gates with the current ceilings. A perf miss
 * holds a branch only when the branch caused it or made it worse, as on the
 * local board. The set is kept, empty, so a future audit can be put here by a
 * ruling rather than by a new mechanism.
 */
export const INFORMATIONAL = new Set([]);

/** Every way the declaration disagrees with the runner's own list. Empty when it agrees. */
export function shardProblems(declaredNames) {
  const problems = [];
  const seen = new Map();
  for (const [shard, { audits }] of Object.entries(SHARDS)) {
    for (const name of audits) {
      if (seen.has(name)) problems.push(`${name} is in two shards, ${seen.get(name)} and ${shard}`);
      seen.set(name, shard);
    }
  }
  const declared = new Set(declaredNames);
  for (const name of declared) if (!seen.has(name)) problems.push(`${name} is declared by the runner and in no shard`);
  for (const name of seen.keys()) if (!declared.has(name)) problems.push(`${name} is in a shard and not declared by the runner`);
  return problems;
}
