import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { isKnown, money, type Cents } from "@/lib/ops-money";
import { can } from "@/lib/ops-authz";
import { chargeLog, chargeLogPeriods, productionLedger, timeLog } from "@/lib/ops-engineer";
import { isBriskReview, outcomeLabel, periodOf } from "@/lib/ops-review";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { ExportButton, TimeForm } from "./ChargeLogClient";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { STAFF_LIST_PAGE_SIZE, staffListPage, staffListQuery, staffListRows, type StaffListSpec } from "@/lib/staff-lists";

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

/* ops-money, for the reason recorded on the techs screen. */
const sumKnown = (rows: { amount_cents: number | null }[]): Cents =>
  rows.some((r) => !isKnown(r.amount_cents))
    ? null
    : rows.reduce((s, r) => s + (r.amount_cents as number), 0);

const when = (value: string) =>
  (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "");

type ChargeRow = Awaited<ReturnType<typeof chargeLog>> extends { ok: true; rows: (infer R)[] } | { ok: false; error: string } ? R : never;

/* Search, filter, sort and pages within one month (office-ready table, 2026-11-13). Newest review first by default. */
const CHARGE_LIST: StaffListSpec<ChargeRow> = {
  text: (r) => [r.property_address, r.county],
  filters: {
    decision: {
      sealed: (r) => r.decision === "seal",
      declined: (r) => Boolean(r.refused),
      other: (r) => r.decision !== "seal" && !r.refused,
    },
  },
  sorts: {
    reviewed: { key: (r) => r.reviewed_at, ascending: false },
    address: { key: (r) => r.property_address, ascending: true },
  },
  defaultSort: "reviewed",
};

export default async function ChargeLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await currentActor();
  if (!can(actor, "responsible_charge.read_own")) notFound();
  const params = await searchParams;

  const periods = await chargeLogPeriods(actor);
  const period = params.period && /^\d{4}-\d{2}$/.test(params.period) ? params.period : (periods[0] ?? periodOf(new Date()));

  const [logRead, productionRead, time] = await Promise.all([
    chargeLog(actor, { period }),
    productionLedger(actor),
    timeLog(actor),
  ]);

  /* A failed read is said where its figures would be, never "Nothing recorded" or "Nothing for" (F23). */
  const rows = logRead.ok ? logRead.rows : [];
  const production = productionRead.ok ? productionRead.rows : [];
  const refusals = rows.filter((r) => r.refused);
  const sealed = rows.filter((r) => r.decision === "seal");
  const forPeriod = production.filter((p) => p.period === period);
  const pending = forPeriod.filter((p) => p.status === "pending" || p.status === "approved");
  /* The month's summary above counts every review; the search, filter, sort and page below narrow only the list (office-ready table, 2026-11-13). */
  const query = staffListQuery(params, CHARGE_LIST);
  const shown = staffListPage(staffListRows(rows, query, CHARGE_LIST), query.page);

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Responsible charge"
        lede="What you were responsible for, what it paid, and where the hours went. Every row here was written by the platform from a review that happened. None of it can be edited, including by you."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,380px)]">
        <div>
          {/*
            EVERY MONTH IS REACHABLE. The tabs show the latest twelve; a month
            older than that had no way in, so the select below lists every month
            the log holds (office-ready table, 2026-11-13).
          */}
          {periods.length > 12 ? (
            <form method="get" action="/portal/charge-log" className="mb-3 flex flex-wrap items-end gap-3">
              <label>
                <span className="block text-[14px] font-semibold text-[var(--ink)]">Any month</span>
                <select name="period" defaultValue={period} className="mt-1 min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-[15px]">
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="min-h-[44px] rounded-[var(--radius-control)] border border-[var(--navy)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-[var(--on-navy)]">
                Open
              </button>
            </form>
          ) : null}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {periods.length === 0 ? null : (
              periods.slice(0, 12).map((p) => (
                <a
                  key={p}
                  href={`/portal/charge-log?period=${p}`}
                  className={`inline-flex min-h-[40px] items-center rounded-[2px] border px-3 text-[14px] font-semibold ${
                    p === period ? "border-slate bg-slate text-[var(--on-navy)]" : "border-[var(--border)] text-[var(--secondary)]"
                  }`}
                >
                  {p}
                </a>
              ))
            )}
          </div>

          {!logRead.ok ? (
            <p role="alert" className="text-[14px] leading-[1.55] text-[var(--ink)]">
              {logRead.error} Nothing in it has changed; this is a failed read, not an empty log. Reload the page in a moment.
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              title={`Nothing recorded for ${period}`}
              body="A row appears here every time you decide a file: sealed, sent back, sent for a site visit, or declined. Nothing is written by hand, and nothing can be edited afterwards."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] text-[var(--secondary)]">
                  {rows.length} review{rows.length === 1 ? "" : "s"} in {period}
                  {refusals.length > 0
                    ? `, ${refusals.length} of which you declined to seal`
                    : ", none declined"}
                  {sealed.length > 0 ? `, ${sealed.length} sealed` : ""}
                  .
                </p>
                <ExportButton period={period} />
              </div>

              <ListControls
                action="/portal/charge-log"
                search={params.q ?? ""}
                searchLabel="Search address or county"
                filters={[
                  {
                    name: "decision",
                    label: "Decision",
                    value: query.filters.decision ?? "",
                    options: [
                      { value: "", label: "Every decision" },
                      { value: "sealed", label: "Sealed" },
                      { value: "declined", label: "Declined to seal" },
                      { value: "other", label: "Sent back or for a visit" },
                    ],
                  },
                ]}
                sorts={[
                  { value: "reviewed", label: "Reviewed" },
                  { value: "address", label: "Address" },
                ]}
                sort={query.sort}
                direction={query.ascending ? "asc" : "desc"}
                keep={{ period }}
              />

              {shown.total === 0 ? (
                <EmptyState title="No review in this month matches that" body="Clear the search or the filter to see every review in the month." />
              ) : null}
              <ul className="border-t border-[var(--row-rule)]">
                {shown.rows.map((r) => (
                  <li
                    key={r.id}
                    className={`border-b border-[var(--row-rule)] py-3 ${
                      r.refused ? "border-l-2 border-l-[var(--ink)] pl-3" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[var(--ink)]">{r.property_address}</p>
                        <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                          {r.county} County, {when(r.reviewed_at)}
                          {r.review_minutes !== null
                            ? `, ${r.review_minutes} ${r.review_minutes === 1 ? "minute" : "minutes"}`
                            : ", time not measured"}
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
                      <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
                        {r.refusal_reason}
                      </p>
                    ) : null}

                    {isBriskReview(r.review_minutes) ? (
                      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">
                        Under three minutes. Flagged on your own record so you see it before anybody
                        asks, and never blocked: a minimum review time would only teach people to
                        leave the tab open.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {shown.total > 0 ? (
                <Pager page={shown.page} pageSize={STAFF_LIST_PAGE_SIZE} total={shown.total} hrefFor={(n) => listHref("/portal/charge-log", { ...params, period }, { page: n > 1 ? String(n) : "" })} />
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            title="Production"
            description="Paid on the completed review, not on the seal. A file you decline pays the same as one you seal, because paying for one conclusion and not the other is paying for the conclusion."
          >
            {!productionRead.ok ? (
              <p role="alert" className="text-[14px] leading-[1.55] text-[var(--ink)]">
                {productionRead.error} So no figure is shown for {period}: this is a failed read, not a month with nothing in it.
              </p>
            ) : forPeriod.length === 0 ? (
              <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
                Nothing for {period}. An entry is written when you decide a file, if a production
                rate exists for that service line.
              </p>
            ) : (
              <>
                <dl className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="portal-label">
                      This month
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--ink)]">
                      {money(sumKnown(forPeriod))}
                    </dd>
                  </div>
                  <div>
                    <dt className="portal-label">
                      Unpaid
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--ink)]">
                      {money(sumKnown(pending))}
                    </dd>
                  </div>
                </dl>
                <ul className="divide-y divide-limestone-line">
                  {forPeriod.slice(0, 20).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 text-[14px] text-[var(--secondary)]">{p.note ?? "Review"}</span>
                      <span className="shrink-0 text-[14px] font-semibold text-[var(--ink)]">
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
              <p className="mt-4 text-[14px] leading-[1.55] text-[var(--secondary)]">
                Nothing logged by hand yet. Review time is recorded automatically and appears on the
                left.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-limestone-line">
                {time.slice(0, 12).map((t) => (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-semibold text-[var(--ink)]">
                        {t.kind.replace(/_/g, " ")}
                      </span>
                      <span className="text-[14px] text-[var(--secondary)]">
                        {t.minutes === null ? "time not measured" : `${t.minutes} min`}
                        {t.entered_manually ? ", by hand" : ""}
                      </span>
                    </div>
                    {t.note ? (
                      <p className="mt-0.5 text-[13px] leading-[1.5] text-[var(--secondary)]">{t.note}</p>
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
