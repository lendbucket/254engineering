import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { chargeLog, chargeLogPeriods, productionLedger, timeLog } from "@/lib/ops-engineer";
import { isBriskReview, outcomeLabel, periodOf } from "@/lib/ops-review";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { ExportButton, TimeForm } from "./ChargeLogClient";

export const dynamic = "force-dynamic";

/**
 * The responsible charge log, the production ledger, and the time log.
 *
 * WHY THESE THREE ARE ON ONE SCREEN
 * ---------------------------------
 * They are the same month seen three ways: what the engineer was responsible
 * for, what they were paid for it, and where the hours went. An engineer
 * checking that the platform has their month right needs to compare them, and
 * comparing across three screens is how a discrepancy goes unnoticed.
 *
 * THE LOG IS THE POINT AND IT IS NOT EDITABLE
 * -------------------------------------------
 * Every row was written by the system from a review that actually happened, and
 * the table refuses updates and deletes at the database level. Its whole value
 * is that nobody typed it: a log filled in at the end of the month is a
 * recollection, and a recollection is what an enforcement action takes apart.
 *
 * The refusals are shown as prominently as the seals. A log containing only the
 * files an engineer sealed describes an engineer who never said no, which is not
 * a defensible professional record.
 */

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const when = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ChargeLogPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "responsible_charge.read_own")) notFound();
  const params = await searchParams;

  const periods = await chargeLogPeriods(actor);
  const period = params.period && /^\d{4}-\d{2}$/.test(params.period) ? params.period : (periods[0] ?? periodOf(new Date()));

  const [rows, production, time] = await Promise.all([
    chargeLog(actor, { period }),
    productionLedger(actor),
    timeLog(actor),
  ]);

  const refusals = rows.filter((r) => r.refused);
  const sealed = rows.filter((r) => r.decision === "seal");
  const forPeriod = production.filter((p) => p.period === period);
  const pending = forPeriod.filter((p) => p.status === "pending" || p.status === "approved");

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Responsible charge"
        lede="What you were responsible for, what it paid, and where the hours went. Every row here was written by the platform from a review that happened. None of it can be edited, including by you."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,380px)]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {periods.length === 0 ? null : (
              periods.slice(0, 12).map((p) => (
                <a
                  key={p}
                  href={`/portal/charge-log?period=${p}`}
                  className={`inline-flex min-h-[40px] items-center rounded-[3px] border px-3 text-[13.5px] font-semibold ${
                    p === period ? "border-slate bg-slate text-[var(--navy)]-fg" : "border-[var(--border)] text-[var(--secondary)]"
                  }`}
                >
                  {p}
                </a>
              ))
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title={`Nothing recorded for ${period}`}
              body="A row appears here every time you decide a file: sealed, sent back, sent for a site visit, or declined. Nothing is written by hand, and nothing can be edited afterwards."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13.5px] text-[var(--secondary)]">
                  {rows.length} review{rows.length === 1 ? "" : "s"} in {period}
                  {refusals.length > 0
                    ? `, ${refusals.length} of which you declined to seal`
                    : ", none declined"}
                  {sealed.length > 0 ? `, ${sealed.length} sealed` : ""}
                  .
                </p>
                <ExportButton period={period} />
              </div>

              <ul className="flex flex-col gap-2">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-[4px] border bg-white p-4 ${
                      r.refused
                        ? "border-[var(--warn-border)] border-l-[var(--red)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-[var(--navy)]">{r.property_address}</p>
                        <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">
                          {r.county} County, {when(r.reviewed_at)}
                          {r.review_minutes !== null ? `, ${r.review_minutes} minutes` : ", time not measured"}
                          {r.revision_count > 0 ? `, ${r.revision_count} revision${r.revision_count === 1 ? "" : "s"}` : ""}
                          {r.site_visit ? ", site visit" : ""}
                        </p>
                      </div>
                      {/*
                        * Labelled from the decision, never from "not refused".
                        * A revision request rendered as "Sealed" is a false
                        * statement about a licensed engineer's work, and this
                        * screen and the export both used to make it.
                        */}
                      <Chip
                        label={outcomeLabel(r)}
                        tone={r.refused ? "bad" : r.decision === "seal" ? "good" : "neutral"}
                      />
                    </div>

                    {r.refusal_reason ? (
                      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--red)]">
                        {r.refusal_reason}
                      </p>
                    ) : null}

                    {isBriskReview(r.review_minutes) ? (
                      <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
                        Under three minutes. Flagged on your own record so you see it before anybody
                        asks, and never blocked: a minimum review time would only teach people to
                        leave the tab open.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            title="Production"
            description="Paid on the completed review, not on the seal. A file you decline pays the same as one you seal, because paying for one conclusion and not the other is paying for the conclusion."
          >
            {forPeriod.length === 0 ? (
              <p className="text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                Nothing for {period}. An entry is written when you decide a file, if a production
                rate exists for that service line.
              </p>
            ) : (
              <>
                <dl className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="portal-kicker text-[var(--gold-deep)]">
                      This month
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--navy)]">
                      {money(forPeriod.reduce((s, p) => s + p.amount_cents, 0))}
                    </dd>
                  </div>
                  <div>
                    <dt className="portal-kicker text-[var(--gold-deep)]">
                      Unpaid
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--navy)]">
                      {money(pending.reduce((s, p) => s + p.amount_cents, 0))}
                    </dd>
                  </div>
                </dl>
                <ul className="divide-y divide-limestone-line">
                  {forPeriod.slice(0, 20).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 text-[13.5px] text-[var(--secondary)]">{p.note ?? "Review"}</span>
                      <span className="shrink-0 text-[13.5px] font-semibold text-[var(--navy)]">
                        {money(p.amount_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel
            title="Time"
            description="Review time is measured between opening a package and deciding it. Anything else you want on the record, you add here, and it is marked as entered by hand so the two can be told apart."
          >
            <TimeForm />
            {time.length === 0 ? (
              <p className="mt-4 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                Nothing logged by hand yet. Review time is recorded automatically and appears on the
                left.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-limestone-line">
                {time.slice(0, 12).map((t) => (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-semibold text-[var(--navy)]">
                        {t.kind.replace(/_/g, " ")}
                      </span>
                      <span className="text-[13.5px] text-[var(--secondary)]">
                        {t.minutes ?? 0} min
                        {t.entered_manually ? ", by hand" : ""}
                      </span>
                    </div>
                    {t.note ? (
                      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{t.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
