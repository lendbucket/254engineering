import { CATALOG } from "@data/catalog";
import { WPI8_EXTRA_VISIT_CENTS, WPI8_ONGOING_INCLUDED_VISITS } from "@/config/prices";
import { TECHNICIAN_CALL_CENTS, processingCentsFor, PROCESSING_READ_ON, PROCESSING_READ_FROM } from "@/config/cost-inputs";
import { ENGINEER_MONTHLY_RETAINER_CENTS, engineerPayCents, tierForDeliverable } from "@/config/engineer-pay";

/**
 * ===========================================================================
 * COST PER JOB. A REPORT ONLY. Operator ruling, 2026-10-06.
 * ===========================================================================
 *
 * docs/rulings-2026-10-06.md section 7 item 2: "marketed price, technician
 * cost at $85 a visit (four on WP-001), the engineer's fee for the line read
 * from the executed agreement and the code and cited, card processing at
 * Stripe's standard rate, and net per job; WP-001's extra visit as its own row
 * at $150 against $85; his $1,500 monthly retainer on its own line, not
 * divided into jobs. A fee the repository does not hold is reported as
 * missing, never guessed."
 *
 * Every figure is read from the one place it is declared, at call time, so the
 * report cannot hold a stale copy. It is a plan for a clean job, which is why
 * it is not price-book's marginForJob: that reads what a job actually cost.
 */

export type CostRow = {
  label: string;
  serviceSlug: string;
  tier: string | null;
  revenueCents: number;
  visits: number;
  technicianCents: number;
  /** Null when the repository holds no fee for this work, and `missing` says so. */
  engineerCents: number | null;
  engineerCitation: string | null;
  processingCents: number;
  /** Null whenever any input is missing. Never a partial sum. */
  netCents: number | null;
  missing: string | null;
  /** A known reason the net overstates, stated on the row. */
  caveat: string | null;
};

const ENGINEER_SOURCE =
  "src/config/engineer-pay.ts, the executed employment agreement's tiered production pay as supplied by the operator, 2026-09-18";
const PROCESSING_SOURCE = `Stripe card rate, src/config/cost-inputs.ts, read ${PROCESSING_READ_ON} from ${PROCESSING_READ_FROM}`;

/*
 * Solar, the structural letter and the repair specification carried a caveat
 * here until 2026-10-07, because their protocols send a technician while the
 * catalogue sold them as desk work. Operator ruling 7 that day made them field
 * work, so they carry the visit like every other field line and the caveat is
 * gone; price-book-audit asserts they now count one visit.
 */

function visitsFor(serviceSlug: string, tier: string, orderType: string): number {
  if (serviceSlug === "windstorm-wpi-8" && tier === "ongoing") return WPI8_ONGOING_INCLUDED_VISITS;
  return orderType === "field" ? 1 : 0;
}

function row(input: {
  label: string;
  serviceSlug: string;
  tier: string | null;
  revenueCents: number;
  visits: number;
  engineerCents: number | null;
  engineerCitation: string | null;
  missing: string | null;
}): CostRow {
  const technicianCents = input.visits * TECHNICIAN_CALL_CENTS;
  const processingCents = processingCentsFor("card", input.revenueCents);
  const netCents =
    input.engineerCents === null ? null : input.revenueCents - technicianCents - input.engineerCents - processingCents;
  return { ...input, technicianCents, processingCents, netCents, caveat: null };
}

/** One row per deliverable with a fixed price, then WP-001's extra visit. Quoted and hourly lines are listed as such. */
export function costPerJob(): { rows: CostRow[]; notPriced: { label: string; because: string }[]; retainerCents: number; sources: string[] } {
  const rows: CostRow[] = [];
  const notPriced: { label: string; because: string }[] = [];

  for (const entry of CATALOG) {
    const label = `${entry.name}`;
    if (entry.priceCents === null || entry.orderType === "quote") {
      notPriced.push({ label, because: "Quoted per job, so there is no marketed price to set a cost against." });
      continue;
    }
    const payTier = tierForDeliverable(entry.serviceSlug, entry.tier);
    rows.push(
      row({
        label,
        serviceSlug: entry.serviceSlug,
        tier: entry.tier,
        revenueCents: entry.priceCents,
        visits: visitsFor(entry.serviceSlug, entry.tier, entry.orderType),
        engineerCents: payTier === null ? null : engineerPayCents(payTier),
        engineerCitation: payTier === null ? null : `tier ${payTier}, ${ENGINEER_SOURCE}`,
        missing: payTier === null ? "The engineer's fee for this deliverable is not in the repository, so no net is stated." : null,
      }),
    );
  }

  /*
   * THE EXTRA VISIT, ITS OWN ROW. $150 to the customer, $85 to the technician.
   * The agreement as recorded pays the engineer per job, by tier, and says
   * nothing about a visit beyond the four, so his fee for it is MISSING rather
   * than zero, and the row states no net. The two known figures are still
   * shown, which is what the ruling asked to see.
   */
  rows.push(
    row({
      label: "Windstorm, ongoing construction: each stage visit beyond the four included",
      serviceSlug: "windstorm-wpi-8",
      tier: null,
      revenueCents: WPI8_EXTRA_VISIT_CENTS,
      visits: 1,
      engineerCents: null,
      engineerCitation: null,
      missing:
        "Whether the engineer is paid anything for a visit beyond the four is not in the repository; the recorded agreement pays per job, by tier. No net is stated until it is.",
    }),
  );

  return {
    rows,
    notPriced,
    retainerCents: ENGINEER_MONTHLY_RETAINER_CENTS,
    sources: [
      "Marketed prices: data/catalog.ts, filled from src/config/prices.ts",
      `Technician: $${TECHNICIAN_CALL_CENTS / 100} a visit, src/config/cost-inputs.ts`,
      `Engineer: ${ENGINEER_SOURCE}`,
      PROCESSING_SOURCE,
      "Retainer: operator ruling of 2026-10-06, docs/rulings-2026-10-06.md section 7",
    ],
  };
}
