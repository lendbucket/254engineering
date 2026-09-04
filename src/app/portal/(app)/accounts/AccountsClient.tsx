"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";
import { Chip } from "@/components/portal/surfaces";

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
export function AccountsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
      setNote(
        data.reference
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
      <ul className="divide-y divide-limestone-line">
        {rows.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold text-slate">{r.clientName}</span>
              <Chip
                label={r.billingMode === "invoice" ? `invoiced, net ${r.netDays}` : "pays by card"}
                tone="neutral"
              />
              {r.status !== "active" ? <Chip label={r.status} tone="bad" /> : null}
              {!r.canOrder && r.status === "active" ? <Chip label="cannot order" tone="bad" /> : null}
              <span className="ml-auto text-[13px] text-slate-muted">
                {r.orders} order{r.orders === 1 ? "" : "s"}, {r.ordersThisPeriod} this period
              </span>
            </div>

            {r.billingMode === "invoice" ? (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-muted">
                <span>
                  Issued and unpaid <span className="font-semibold text-slate">{money(r.issuedUnpaidCents)}</span>
                </span>
                <span>
                  Not yet billed <span className="font-semibold text-slate">{money(r.unbilledCents)}</span>
                </span>
                <span>
                  Limit{" "}
                  <span className="font-semibold text-slate">
                    {r.creditLimitCents === null ? "none agreed" : money(r.creditLimitCents)}
                  </span>
                </span>
                {r.oldestUnpaidDays !== null ? (
                  <span className="text-[#8a1f1f]">
                    Oldest unpaid {r.oldestUnpaidDays} day{r.oldestUnpaidDays === 1 ? "" : "s"} past due
                  </span>
                ) : null}
              </div>
            ) : null}

            {!r.canOrder && r.status === "active" ? (
              <p className="mt-2 max-w-[76ch] rounded-[3px] bg-[#fdf3e0] px-3 py-2 text-[13px] leading-[1.55] text-[#7a4c05]">
                {r.blockedReason}
              </p>
            ) : null}

            {r.billingMode === "invoice" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act({ action: "close-period", accountId: r.id }, `close-${r.id}`)}
                  className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line bg-white px-4 text-[13px] font-semibold text-slate disabled:opacity-45"
                >
                  {busy === `close-${r.id}` ? "Closing" : "Close this period"}
                </button>

                {r.openStatement ? (
                  <>
                    <span className="font-mono text-[12.5px] text-slate-muted">
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
                      className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13px] font-bold text-white disabled:opacity-45"
                    >
                      {busy === `issue-${r.id}` ? "Issuing" : "Issue it"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] bg-[#fdecec] px-3 py-2 text-[13px] text-[#8a1f1f]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-4 rounded-[3px] bg-[#eef6ee] px-3 py-2 text-[13px] text-[#22551f]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
