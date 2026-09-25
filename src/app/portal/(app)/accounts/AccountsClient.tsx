"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";
import { Chip } from "@/components/portal/surfaces";
import Link from "next/link";

type Row = {
  id: string;
  clientName: string;
  status: "active" | "suspended" | "closed";
  billingMode: "card" | "invoice";
  creditLimitCents: number | null;
  netDays: number;
  orders: number;
  ordersThisPeriod: number;
  issuedUnpaidCents: number | null;
  unbilledCents: number | null;
  oldestUnpaidDays: number | null;
  canOrder: boolean;
  blockedReason: string;
  users: number;
  openStatement: { id: string; reference: string; period: string; totalCents: number | null } | null;
};

/**
 * The two acts that turn work into a bill, and the terms behind them.
 *
 * Closing a period is separate from issuing the statement, deliberately. Closing
 * gathers what is unbilled and lets the operator look at it; issuing is the
 * moment it becomes a document the customer has been sent and the due date
 * starts running. Doing both in one button would mean a mistake in the gather is
 * a mistake in a bill.
 */
/**
 * =============================================================================
 * HOW MANY ACCOUNTS REACH THE PAGE AT ONCE. Operator ruling, 2026-09-24.
 * =============================================================================
 *
 * "An unbounded list is a defect whether it holds 5 rows or 544."
 *
 * This list had no bound at all and nobody noticed, for a reason worth keeping:
 * `/portal/accounts` took 118 seconds to render and every browser audit that
 * reached it timed out, so `native-audit`'s bounded-list rule had never once
 * been able to measure this screen. Fixing the cliff underneath it is what made
 * the list observable, and the very first board that could see it reported 544
 * visible rows against a ceiling of 250.
 *
 * That is worth stating rather than filing as a regression: the pagination was
 * missing the whole time, and a defect hidden behind a hang is not a defect
 * that was introduced when the hang was fixed.
 *
 * FIFTY, which is two pages of a phone's scroll rather than twenty-two, and
 * well under the audit's 250. The remainder is STATED rather than dropped, for
 * the reason the reports module gives about its own window: a table that
 * silently stops is a reader counting fifty rows under a heading that says 544.
 */
const PER_PAGE = 50;

export function AccountsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  /*
   * SEARCH BEFORE PAGING, so a search covers every account rather than the
   * fifty currently on screen. A filter applied after the window would be the
   * bounded-read defect wearing a text box: it would look like a search and
   * would be a search of one page.
   */
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? rows.filter((r) => r.clientName.toLowerCase().includes(needle))
    : rows;

  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * PER_PAGE;
  const shown = matching.slice(from, from + PER_PAGE);

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      /*
       * Issuing is queued now, so the notice says queued. Telling the operator
       * a statement was sent when a job has only been written is the same shape
       * of lie as a webhook reporting handled for a write that never happened.
       */
      setNote(
        data.queued
          ? `${data.reference ?? "It"} is queued to issue${data.duplicate ? ", and was already waiting" : ""}. The job queue shows it if the send fails.`
          : data.reference
            ? `${data.reference}: ${data.lines ?? 0} line${data.lines === 1 ? "" : "s"}, ${money(data.totalCents ?? null)}`
            : "Done.",
      );
      router.refresh();
    } catch {
      setError("The request did not complete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        {/*
          aria-label RATHER THAN A VISUALLY HIDDEN SPAN, and the reason is
          measured rather than stylistic.

          This was `<span className="sr-only">`, and native-audit went red:
          "/portal/accounts: the page itself does not scroll (the document
          scrolls by 308px)". Nothing was visible past the fold and every box on
          the page measured 844. Hiding the span at runtime took the overflow to
          exactly 0; changing the flex alignment did nothing.

          Tailwind's `sr-only` is `position: absolute`, and nothing between here
          and <body> is positioned, so it resolves against the INITIAL
          CONTAINING BLOCK. Its static position is deep inside a scrolling
          region 11,166px tall, so the browser extended the document to reach
          it. An element that is invisible, unreachable and one pixel square,
          silently making the whole page scroll.

          A label that needs no box is an attribute. This also removes the last
          positioned-escape hazard from the control, where adding `relative` to
          the label would only have hidden it behind a fix nobody could explain.

          WORTH KNOWING BEYOND THIS SCREEN: any `sr-only` element placed inside
          the portal's scroll region has this shape. Point 1 is the only check
          that can see it, and it sees it as a page that scrolls.
        */}
        <label className="flex-1 min-w-[200px]">
          <input
            type="search"
            aria-label="Search accounts by organization name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by organization"
            /* min-h-44 because this is a new interactive control on a screen
             * mobile-audit measures, and py-2 alone lands it under the tap
             * target minimum. Caught by asking, before the board, which rules
             * a change makes newly applicable rather than waiting to be told. */
            className="min-h-[44px] w-full rounded-[4px] border border-limestone-line px-3 py-2 text-[13.5px] text-[var(--navy)]"
          />
        </label>
        {/*
          THE TOTAL AND THE WINDOW, BOTH, because either alone misleads. The
          count of what is shown without the total is a reader believing they
          have seen everything; the total without the window is a reader
          wondering where the rest went.
        */}
        <p className="text-[13.5px] text-[var(--secondary)]">
          {matching.length === 0
            ? needle
              ? `No account matches "${query.trim()}". ${rows.length} in total.`
              : "No accounts."
            : `Showing ${from + 1} to ${from + shown.length} of ${matching.length}${
                needle ? ` matching "${query.trim()}", ${rows.length} in total` : ""
              }, ${PER_PAGE} to a page.`}
        </p>
      </div>

      <ul className="divide-y divide-limestone-line">
        {shown.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13.5px] font-semibold text-[var(--navy)]">{r.clientName}</span>
              <Chip
                label={r.billingMode === "invoice" ? `invoiced, net ${r.netDays}` : "pays by card"}
                tone="neutral"
              />
              {r.status !== "active" ? <Chip label={r.status} tone="bad" /> : null}
              {!r.canOrder && r.status === "active" ? <Chip label="cannot order" tone="bad" /> : null}
              <span className="ml-auto text-[13.5px] text-[var(--secondary)]">
                {r.orders} order{r.orders === 1 ? "" : "s"}, {r.ordersThisPeriod} this period
              </span>
            </div>

            {r.billingMode === "invoice" ? (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-[var(--secondary)]">
                <span>
                  Issued and unpaid <span className="font-semibold text-[var(--navy)]">{money(r.issuedUnpaidCents)}</span>
                </span>
                <span>
                  Not yet billed <span className="font-semibold text-[var(--navy)]">{money(r.unbilledCents)}</span>
                </span>
                <span>
                  Limit{" "}
                  <span className="font-semibold text-[var(--navy)]">
                    {r.creditLimitCents === null ? "none agreed" : money(r.creditLimitCents)}
                  </span>
                </span>
                {r.oldestUnpaidDays !== null ? (
                  <span className="text-[var(--red)]">
                    Oldest unpaid {r.oldestUnpaidDays} day{r.oldestUnpaidDays === 1 ? "" : "s"} past due
                  </span>
                ) : null}
              </div>
            ) : null}

            {!r.canOrder && r.status === "active" ? (
              <p className="mt-2 max-w-[76ch] rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
                {r.blockedReason}
              </p>
            ) : null}

            {/*
              THE WAY IN TO TRADE PRICING, ON EVERY ACCOUNT RATHER THAN ONLY
              INVOICED ONES.

              The buttons below are invoiced-account acts: closing a period,
              issuing a statement. A trade price is not. An account paying by
              card can be quoted an agreed price just as an invoiced one can,
              and hiding the link for them would be the screen deciding who may
              be negotiated with.
            */}
            <div className="mt-3">
              <Link
                href={`/portal/accounts/${r.id}/pricing`}
                className="inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
              >
                Trade pricing
              </Link>
            </div>

            {r.billingMode === "invoice" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act({ action: "close-period", accountId: r.id }, `close-${r.id}`)}
                  className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-45"
                >
                  {busy === `close-${r.id}` ? "Closing" : "Close this period"}
                </button>

                {r.openStatement ? (
                  <>
                    <span className="font-mono text-[12.5px] text-[var(--secondary)]">
                      {r.openStatement.reference} open, {money(r.openStatement.totalCents)}
                    </span>
                    <button
                      type="button"
                      disabled={busy !== null || (r.openStatement.totalCents ?? 0) <= 0}
                      onClick={() =>
                        act(
                          { action: "issue-statement", statementId: r.openStatement!.id },
                          `issue-${r.id}`,
                        )
                      }
                      className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13.5px] font-bold text-white disabled:opacity-45"
                    >
                      {busy === `issue-${r.id}` ? "Queueing" : "Issue it"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-4 rounded-[3px] bg-[var(--green-bg)] px-3 py-2 text-[13.5px] text-[var(--green)]">
          {note}
        </p>
      ) : null}

      {pages > 1 ? (
        <nav aria-label="Accounts pages" className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
            className="min-h-[44px] rounded-[4px] border border-limestone-line px-4 text-[13.5px] text-[var(--navy)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[13.5px] text-[var(--secondary)]">
            Page {current} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages}
            className="min-h-[44px] rounded-[4px] border border-limestone-line px-4 text-[13.5px] text-[var(--navy)] disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
