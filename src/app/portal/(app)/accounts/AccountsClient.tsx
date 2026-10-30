"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";
import { Chip } from "@/components/portal/surfaces";
import Link from "next/link";
import {
  NET_DAYS_MAX,
  NET_DAYS_MIN,
  TERMS_PASSWORD_MISSING,
  centsFromDollars,
  dollarsForInput,
} from "@/lib/account-terms";

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
 *
 * SINCE 2026-10-28 THE FIFTY ARE CHOSEN ON THE SERVER (ACCOUNT_PAGE_SIZE in
 * account-list.ts). This component used to receive every account and search
 * and page them in the browser, which meant reading every figure for about
 * 3,020 accounts to show fifty: 10 seconds on board 40733329479. The search,
 * the filters, the sort and the pager are a GET form and links on the page now,
 * with the total and the window stated there, and this renders the page given.
 */
export function AccountsClient({
  rows,
  pager,
  canSetTerms = false,
}: {
  rows: Row[];
  pager?: ReactNode;
  /** accounts.manage, read by the page. Without it no terms panel is drawn. */
  canSetTerms?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const shown = rows;

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
      <div>
        {/*
          THE SEARCH BOX THAT LIVED HERE MOVED TO THE PAGE'S GET FORM on
          2026-10-28, with visible labels. Its lesson is kept, because it holds
          for any control put back here: an aria-label RATHER THAN A VISUALLY
          HIDDEN SPAN, and the reason is measured rather than stylistic.

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
      </div>

      <ul className="divide-y divide-limestone-line">
        {shown.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold text-[var(--ink)]">{r.clientName}</span>
              <Chip
                label={r.billingMode === "invoice" ? `invoiced, net ${r.netDays}` : "pays by card"}
                tone="neutral"
              />
              {r.status !== "active" ? <Chip label={r.status} tone="bad" /> : null}
              {!r.canOrder && r.status === "active" ? <Chip label="cannot order" tone="bad" /> : null}
              <span className="ml-auto text-[14px] text-[var(--secondary)]">
                {r.orders} order{r.orders === 1 ? "" : "s"}, {r.ordersThisPeriod} this period
              </span>
            </div>

            {r.billingMode === "invoice" ? (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-[var(--secondary)]">
                <span>
                  Issued and unpaid <span className="font-semibold text-[var(--ink)]">{money(r.issuedUnpaidCents)}</span>
                </span>
                <span>
                  Not yet billed <span className="font-semibold text-[var(--ink)]">{money(r.unbilledCents)}</span>
                </span>
                <span>
                  Limit{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    {r.creditLimitCents === null ? "none agreed" : money(r.creditLimitCents)}
                  </span>
                </span>
                {r.oldestUnpaidDays !== null ? (
                  <span className="text-[var(--ink)]">
                    Oldest unpaid {r.oldestUnpaidDays} day{r.oldestUnpaidDays === 1 ? "" : "s"} past due
                  </span>
                ) : null}
              </div>
            ) : null}

            {!r.canOrder && r.status === "active" ? (
              <p className="mt-2 max-w-[76ch] rounded-[2px] px-3 py-2 text-[14px] leading-[1.55] text-[var(--ink)]">
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
                className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-2"
              >
                Trade pricing
              </Link>
            </div>

            {canSetTerms ? <TermsPanel row={r} /> : null}

            {r.billingMode === "invoice" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act({ action: "close-period", accountId: r.id }, `close-${r.id}`)}
                  className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-45"
                >
                  {busy === `close-${r.id}` ? "Closing" : "Close this period"}
                </button>

                {r.openStatement ? (
                  <>
                    <span className="text-[13px] text-[var(--secondary)]">
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
                      className="inline-flex min-h-[44px] items-center rounded-[2px] bg-slate px-4 text-[14px] font-bold text-white disabled:opacity-45"
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
        <p role="alert" className="mt-4 rounded-[2px] px-3 py-2 text-[14px] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-4 border-l-2 border-[var(--ink)] py-1 pl-3 text-[14px] text-[var(--ink)]">
          {note}
        </p>
      ) : null}

      {/* The server's pager, with the total and the window: links, so a page can be sent and printed. */}
      {pager}

      <SendResetLink />
    </div>
  );
}

/**
 * CHANGE AN ACCOUNT'S CREDIT TERMS. Robert's ruling, 10:52 Central 2026-10-29,
 * 254-WF-022 step 3: confirmed by the administrator's password, entered again
 * here, and recorded before the change (setAccountTerms, ops-accounts-admin.ts).
 *
 * Closed until asked for, one per account row, so a list of fifty accounts is
 * not fifty forms. The current terms are printed above the fields, so the
 * person sees what they are changing from before they type.
 */
function TermsPanel({ row }: { row: Row }) {
  const router = useRouter();
  const [billingMode, setBillingMode] = useState<"card" | "invoice">(row.billingMode);
  const [limit, setLimit] = useState(dollarsForInput(row.creditLimitCents));
  const [netDays, setNetDays] = useState(String(row.netDays));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const id = `terms-${row.id}`;

  return (
    <details className="mt-3">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-2">
        Change terms
      </summary>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--secondary)]">
        Now: {row.billingMode === "invoice" ? `invoiced, net ${row.netDays} days` : "pays by card"}, credit limit{" "}
        {row.creditLimitCents === null ? "none agreed" : money(row.creditLimitCents)}. A change asks for your
        password again and is recorded before it is saved.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError(null);
          setNote(null);
          const cents = centsFromDollars(limit);
          if (!cents.ok) return setError(cents.error);
          const days = Number(netDays);
          if (!Number.isInteger(days) || days < NET_DAYS_MIN || days > NET_DAYS_MAX) {
            return setError(`Net days are a whole number from ${NET_DAYS_MIN} to ${NET_DAYS_MAX}.`);
          }
          if (!password) return setError(TERMS_PASSWORD_MISSING);
          setBusy(true);
          try {
            const res = await fetch("/api/portal/accounts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "set-terms",
                accountId: row.id,
                billingMode,
                creditLimitCents: cents.cents,
                netDays: days,
                password,
              }),
            });
            const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; changed?: string[] } | null;
            if (!res.ok || !data?.ok) {
              setError(data?.error ?? "That did not work. Nothing was changed.");
              return;
            }
            setPassword("");
            setNote(`Saved and recorded: ${(data.changed ?? []).join(", ").replace(/_/g, " ")}.`);
            router.refresh();
          } catch {
            setError("The network did not answer. The terms may not have changed; reload to see them.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5" htmlFor={`${id}-mode`}>
          <span className="text-[13px] font-bold text-[var(--secondary)]">Billing</span>
          <select
            id={`${id}-mode`}
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value === "invoice" ? "invoice" : "card")}
            className="min-h-[44px] rounded-[2px] border border-limestone-line px-3 text-[14px] text-[var(--ink)]"
          >
            <option value="card">Pays by card</option>
            <option value="invoice">Invoiced</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5" htmlFor={`${id}-limit`}>
          <span className="text-[13px] font-bold text-[var(--secondary)]">Credit limit, dollars (empty for none)</span>
          <input
            id={`${id}-limit`}
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            autoComplete="off"
            className="min-h-[44px] w-[10rem] rounded-[2px] border border-limestone-line px-3 text-[14px] text-[var(--ink)]"
          />
        </label>
        <label className="flex flex-col gap-1.5" htmlFor={`${id}-days`}>
          <span className="text-[13px] font-bold text-[var(--secondary)]">Net days</span>
          <input
            id={`${id}-days`}
            inputMode="numeric"
            value={netDays}
            onChange={(e) => setNetDays(e.target.value)}
            autoComplete="off"
            className="min-h-[44px] w-[6rem] rounded-[2px] border border-limestone-line px-3 text-[14px] text-[var(--ink)]"
          />
        </label>
        <label className="flex flex-col gap-1.5" htmlFor={`${id}-password`}>
          <span className="text-[13px] font-bold text-[var(--secondary)]">Your password, entered again</span>
          <input
            id={`${id}-password`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="min-h-[44px] w-[min(100%,16rem)] rounded-[2px] border border-limestone-line px-3 text-[14px] text-[var(--ink)]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving" : "Save the terms"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 rounded-[2px] px-3 py-2 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 border-l-2 border-[var(--ink)] py-1 pl-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {note}
        </p>
      ) : null}
    </details>
  );
}

/**
 * SEND A CUSTOMER A PASSWORD RESET LINK.
 *
 * The customer telephones saying they cannot get in. Until 2026-09-29 there was
 * nothing an operator could do about that: no code anywhere minted a
 * `reset_password` token for a customer, so the only answers available were to
 * open a second account or to give up.
 *
 * IT TAKES A TYPED ADDRESS RATHER THAN SITTING ON EACH ROW, and that is a
 * scope decision worth naming rather than hiding. The rows on this screen are
 * ACCOUNTS, and an account has `users: number` and no addresses: putting a
 * button on a row would mean either sending to a person the operator cannot
 * see, or widening the server query to carry every user of every account
 * through a list that is already paged for being too long. The address is what
 * the person on the telephone is reading out anyway.
 *
 * The consequence is stated in the help text rather than left to be discovered:
 * this sends to whichever customer holds that address, which may be one of
 * several people on the same account.
 *
 * IT DOES NOT SHARE `act`, because that helper posts to /api/portal/accounts
 * and this is its own route. Threading a second URL through it would make one
 * function answer for two endpoints, which is how a screen ends up reporting
 * the wrong thing about the wrong call.
 */
function SendResetLink() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  return (
    <section className="mt-8 border-t border-limestone-line pt-6">
      <h2 className="text-[16px] font-bold text-[var(--ink)]">Send a password reset link</h2>
      <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--secondary)]">
        For a customer who cannot sign in. The link goes to the address on their account and
        nowhere else, it works once, and their current password keeps working until they use it.
        Nobody here sees the link or their password.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          setNote(null);
          try {
            const res = await fetch("/api/portal/accounts/reset-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const data = (await res.json().catch(() => null)) as
              | { ok?: boolean; error?: string; message?: string }
              | null;
            if (!res.ok || !data?.ok) {
              setError(data?.error ?? "That did not work.");
              return;
            }
            setNote(data.message ?? "Sent.");
            setEmail("");
          } catch {
            setError("The network did not answer. Nothing was sent.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[var(--secondary)]">
            Customer email address
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            className="min-h-[44px] w-[min(100%,22rem)] rounded-[2px] border border-limestone-line px-3 text-[14px] text-[var(--ink)]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Sending" : "Send the link"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[2px] px-3 py-2 text-[14px] leading-[1.6] text-[var(--ink)]"
        >
          {error}
        </p>
      ) : null}
      {note ? (
        <p
          role="status"
          className="mt-3 border-l-2 border-[var(--ink)] py-1 pl-3 text-[14px] leading-[1.6] text-[var(--ink)]"
        >
          {note}
        </p>
      ) : null}
    </section>
  );
}
