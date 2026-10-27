import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { PageHead, Panel } from "@/components/portal/surfaces";
import { services } from "@/content/services";
import { priceFor, priceSentence } from "@/config/prices";
import { estimateForLine, money } from "@/lib/price-book";
import { costPerJob } from "@/lib/cost-per-job";
import {
  TECHNICIAN_CALL_CENTS,
  PROCESSING_RATES,
  PROCESSING_READ_ON,
  PROCESSING_READ_FROM,
} from "@/config/cost-inputs";
import { ENGINEER_TIER_CENTS, ENGINEER_DESIGN_FEE_SHARE_BP, SCOPE_ADDENDUM_REQUIRED, defaultTierFor } from "@/config/engineer-pay";
import { lineAddendumState } from "@/lib/scope-addendum";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { AddendumDraftForm } from "./AddendumDraftForm";
import { floorCentsFor } from "@/lib/trade-pricing";

export const dynamic = "force-dynamic";

/**
 * ===========================================================================
 * THE PRICE BOOK. One question: did this make money.
 * ===========================================================================
 *
 * Operator specification, 2026-09-17, built 2026-09-18.
 *
 * WHAT THIS SCREEN SHOWS TODAY AND WHY IT IS NOT A MARGIN REPORT YET. The book
 * answers per JOB and per PERIOD from what jobs actually cost. No service line
 * is open, because no protocol is approved, so there are no jobs and there is
 * nothing to report on. Showing an empty margin table would be the vacuous
 * green this repository spends its time removing: a report over nothing, shaped
 * exactly like a report over something.
 *
 * So what renders is the BOOK itself, which is the thing that exists: per line,
 * the marketed price, the technician rate, the engineer's estimating tier, the
 * floor beneath which it may not be sold, and what a clean job would make. The
 * per job and per period reporting arrives with the first job and is built
 * against real rows rather than against an empty set.
 *
 * EVERY FIGURE IS DERIVED FROM ONE SOURCE. The price is the same value
 * /structural-engineer/cost publishes to customers. The tier is the employment
 * agreement's. The floor is trade-floors, which already exists and is already
 * awaiting the operator's numbers; a second floors file for this screen would
 * be the one-fact-two-homes defect built deliberately.
 *
 * ESTIMATES ARE LABELLED AS ESTIMATES EVERYWHERE THEY APPEAR. estimateForLine
 * returns the assumed tier and the assumed visit count in its own result, and
 * both are rendered, because a figure that could be either a plan or a record
 * is a figure nobody can act on.
 */
/*
 * WHAT THE OWNER'S FORM STARTS FROM, in Robert's words of 2026-10-26, 07:10
 * Central: "$175 per WPI-8 ongoing construction job, one flat amount covering
 * every stage review and the issued certificate for that job, extra stage visits
 * included. Paid on the same schedule as his other per-document pay ... nothing
 * else changes in his agreement." He can change either before drafting.
 */
const ADDENDUM_DRAFTS: Record<string, { label: string; pay: string; scope: string }> = {
  "windstorm-wpi-8/ongoing": {
    label: "WPI-8 ongoing construction",
    pay: "175",
    scope:
      "One flat amount per WPI-8 ongoing construction job, covering every stage review and the issued certificate for that job, extra stage visits included. Paid on the same schedule as the engineer's other per-document pay. Nothing else in the engineer's agreement changes.",
  },
};

export default async function PriceBookPage() {
  const actor = await currentActor();
  /*
   * The same grant that governs trade pricing. A price book is pricing, and a
   * second capability for the same authority is how two answers to one question
   * start to exist.
   */
  if (!can(actor, "pricing.write")) notFound();

  const rows = services.map((service) => ({
    service,
    price: priceFor(service.slug),
    priceLabel: priceSentence(service.slug),
    tier: defaultTierFor(service.slug),
    estimate: estimateForLine(service.slug),
    floor: floorCentsFor(service.slug, "standard"),
  }));

  const costs = costPerJob();

  /* The deliverables his agreement leaves out, each with where its addendum stands (0095). */
  const addenda = can(actor, "addenda.draft")
    ? await Promise.all(
        Object.keys(SCOPE_ADDENDUM_REQUIRED).map(async (deliverable) => ({
          deliverable,
          label: ADDENDUM_DRAFTS[deliverable]?.label ?? deliverable,
          defaultPay: ADDENDUM_DRAFTS[deliverable]?.pay ?? "",
          defaultScope: ADDENDUM_DRAFTS[deliverable]?.scope ?? "",
          state: await lineAddendumState(deliverable),
        })),
      )
    : null;

  return (
    <>
      <PageHead
        title="Price book"
        lede="What each line is sold at, what it costs the firm, and what a clean job makes. Margin per job arrives with the first job."
      />

      <Panel
        title="The book"
        description="Every price here is the same value the site publishes, read from one file. Estimates assume one technician visit and the line's estimating tier, and both assumptions are stated on the row."
      >
        <ul className="flex flex-col gap-4">
          {rows.map(({ service, priceLabel, tier, estimate, floor }) => (
            <li
              key={service.slug}
              className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[15px] font-semibold text-[var(--ink)]">{service.name}</p>
                <p className="text-[15px] font-semibold text-[var(--ink)]">
                  {priceLabel ?? "Quoted per matter"}
                </p>
              </div>

              {estimate.ok ? (
                <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                  Estimated on one technician call at {money(TECHNICIAN_CALL_CENTS)} and tier{" "}
                  {estimate.assumedTier} at {money(estimate.engineerCents)}: cost{" "}
                  {money(estimate.costCents)}, net {money(estimate.netCents)}, margin{" "}
                  {estimate.marginPct}% before card processing.
                </p>
              ) : (
                <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                  No estimate: {estimate.because}
                </p>
              )}

              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--secondary)]">
                {/*
                  THE FLOOR IS READ FROM trade-floors AND IS PENDING ON EVERY
                  LINE. That is not a gap in this screen. The operator ruled that
                  a floor is a decision about money and therefore his, and that a
                  line with no floor cannot be sold at trade pricing at all. The
                  screen states the real position rather than showing a blank.
                */}
                Floor: {floor === null ? "pending the operator's ruling, so this line cannot be sold at trade pricing" : money(floor)}
                {tier === null ? " . No estimating tier." : ` . Estimating tier ${tier}.`}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      {/*
        COST PER JOB, operator ruling of 2026-10-06 (docs/rulings-2026-10-06.md
        section 7 item 2). Per DELIVERABLE rather than per line, with its own
        visit count and card processing at the Stripe card rate, which is the
        ruling's stated assumption and is labelled as one. A fee the repository
        does not hold is shown as missing and the row states no net.
      */}
      <Panel
        title="Cost per job"
        description="A plan for a clean job, per deliverable: the marketed price, the technician at the visits the job includes, the engineer's fee from the agreement, and card processing at the Stripe card rate, assuming the customer pays by card. Not a record of any job."
      >
        <ul className="flex flex-col gap-4">
          {costs.rows.map((r) => (
            <li
              key={`${r.serviceSlug}/${r.tier ?? "extra"}`}
              className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[15px] font-semibold text-[var(--ink)]">{r.label}</p>
                <p className="text-[15px] font-semibold text-[var(--ink)]">{money(r.revenueCents)}</p>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                Technician {money(r.technicianCents)} ({r.visits} {r.visits === 1 ? "visit" : "visits"}).
                Engineer {r.engineerCents === null ? "missing" : money(r.engineerCents)}. Card processing{" "}
                {money(r.processingCents)}.{" "}
                <strong className="text-[var(--ink)]">
                  Net {r.netCents === null ? "not stated" : money(r.netCents)}.
                </strong>
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--secondary)]">
                {r.missing ?? `Engineer's fee: ${r.engineerCitation}.`}
              </p>
              {r.caveat ? (
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--ink)]">{r.caveat}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {costs.notPriced.length > 0 ? (
          <p className="mt-4 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            Quoted per job, so not in this table: {costs.notPriced.map((n) => n.label).join("; ")}.
          </p>
        ) : null}
        <p className="mt-4 text-[13.5px] leading-[1.7] text-[var(--ink)]">
          The engineer&apos;s retainer, {money(costs.retainerCents)} a month, is a cost of having an
          engineer of record rather than of any one job, so it is on its own line and not divided
          into the rows above.
        </p>
        <ul className="mt-3 flex flex-col gap-1 text-[12.5px] leading-[1.6] text-[var(--secondary)]">
          {costs.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Margin per job"
        description="Nothing to report, and the reason is the correct one rather than a defect."
      >
        <p className="text-[13.5px] leading-[1.7] text-[var(--secondary)]">
          Margin is computed from what a job actually cost: the technician calls that actually
          happened and the tier the engineer&apos;s determination actually attracted. That needs
          completed jobs, and this table is built against them when they exist rather than against
          an empty set. An empty margin table would look exactly like a full one from a distance,
          which is why there is not one here.
        </p>
        <p className="mt-3 text-[13.5px] leading-[1.7] text-[var(--secondary)]">
          Where any input is missing on a real job, the book refuses to state a margin and names the
          input rather than substituting a zero or the line&apos;s estimating tier. A margin that
          quietly omits the engineer&apos;s pay is not a smaller margin, it is a wrong one, in the
          flattering direction.
        </p>
      </Panel>

      <Panel
        title="The cost inputs"
        description="Where each number comes from, and which of them are still owed."
      >
        <dl className="flex flex-col gap-3 text-[13.5px] leading-[1.7]">
          <div>
            <dt className="font-semibold text-[var(--ink)]">Field technician</dt>
            <dd className="text-[var(--secondary)]">
              {money(TECHNICIAN_CALL_CENTS)} per call, flat. A second attendance costs again, which
              is why margin is computed from visits that happened rather than from one assumed visit.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Engineer production pay</dt>
            <dd className="text-[var(--secondary)]">
              Tier 1 {money(ENGINEER_TIER_CENTS[1])}, tier 2 {money(ENGINEER_TIER_CENTS[2])}, tier 3{" "}
              {money(ENGINEER_TIER_CENTS[3])}, from the executed employment agreement, with each
              deliverable&apos;s tier set by its Schedule 2. Beam and header sizing is tier 2. A
              custom design engagement pays {ENGINEER_DESIGN_FEE_SHARE_BP / 100}% of its fee under a
              signed scope addendum. WPI-8 ongoing construction is not in Schedule 2 and pays
              nothing until a signed scope addendum covers it.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Payment processing</dt>
            <dd className="text-[var(--secondary)]">
              A cost line in this book and never a line on the site: a customer is not shown a fee
              for the firm&rsquo;s choice of payment provider. The rates are{" "}
              {(PROCESSING_RATES.card.fraction * 100).toFixed(1)}% plus{" "}
              {money(PROCESSING_RATES.card.fixedCents)} on a domestic card and{" "}
              {(PROCESSING_RATES.invoice.fraction * 100).toFixed(1)}% on a one-time invoice payment,
              read from {PROCESSING_READ_FROM} on {PROCESSING_READ_ON}. They are not one rate,
              so a recorded job&rsquo;s margin is computed from how that job was actually paid and
              refuses if the job does not say.
              <br />
              <strong>An estimate on this page is before processing</strong>, because an estimate
              cannot know how a job nobody has taken yet will be paid. That is a different figure
              from a recorded margin and it is labelled on every row rather than in a footnote.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Fuel and mileage</dt>
            <dd className="text-[var(--secondary)]">
              Not in the marketed price and not in this book. They are a cost of running a field
              operation rather than a cost of a job, and attributing them per job needs a mileage
              record nobody keeps yet.
            </dd>
          </div>
        </dl>
      </Panel>

      {/*
        SCOPE ADDENDA FOR THE ENGINEER TO SIGN. Robert's ruling of 2026-10-26,
        07:10 Central (0095). One row per deliverable his agreement leaves out:
        where its addendum stands, and the form that drafts one. The newest
        addendum decides, so drafting a new one replaces the last, and it opens
        nothing until he signs it.
      */}
      {addenda ? (
        <Panel title="Scope addenda for the engineer">
          <p className="max-w-[75ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            A deliverable the engineer&apos;s agreement does not cover pays nothing and cannot be ordered until he signs an
            addendum for it in the portal, from his own account with a fresh code. You draft it here; it then waits on his
            portal for his signature.
          </p>
          <ul className="mt-3">
            {addenda.map((a) => (
              <li key={a.deliverable} className="border-b border-[var(--row-rule)] py-4">
                <p className="text-[15px] font-semibold text-[var(--ink)]">{a.label}</p>
                <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--ink)]">
                  {!a.state.ok
                    ? a.state.why
                    : !a.state.newest
                      ? "No addendum drafted yet."
                      : a.state.signed
                        ? `Signed by the engineer: ${money(a.state.newest.payCents)} per job, drafted ${formatInFirmZone(a.state.newest.createdAt, { month: "short", day: "numeric", year: "numeric" }) ?? ""}.`
                        : `Drafted ${formatInFirmZone(a.state.newest.createdAt, { month: "short", day: "numeric", year: "numeric" }) ?? ""} at ${money(a.state.newest.payCents)} per job, waiting for the engineer's signature.`}
                </p>
                {a.state.ok && !a.state.signed ? (
                  <AddendumDraftForm deliverable={a.deliverable} label={a.label} defaultPay={a.defaultPay} defaultScope={a.defaultScope} />
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
