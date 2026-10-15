"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderAwaitingAccount } from "@/lib/ops-payments";

/**
 * Attach a paid order to an account: the one-click staff action of the
 * operator's ruling of 2026-10-13.
 *
 * Each order offers only the accounts the server will accept, its client's and
 * the paying address's, each named with why it is offered. One click attaches
 * and finishes the release; the server refuses an order that already has an
 * account, so two people pressing at once attach it once. Somebody without
 * accounts.manage sees the list and the reason, and no button.
 */
export function AttachAccountClient({
  orders,
  canAttach,
}: {
  orders: OrderAwaitingAccount[];
  canAttach: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function attach(orderId: string, accountId: string) {
    setBusy(`${orderId}:${accountId}`);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/orders/attach-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The order could not be attached.");
        return;
      }
      setNote(data.note);
      router.refresh();
    } catch {
      setError("The request did not complete, so whether the order was attached is not known. Reload to see.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {orders.map((o) => (
          <li key={o.orderId} className="py-3">
            <p className="text-[13.5px] font-semibold text-[var(--navy)]">{o.reference}</p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--secondary)]">{o.reason}</p>
            {o.needs === "address" ? (
              <p className="mt-2 text-[13.5px] text-[var(--secondary)]">
                Give the account an owner or a billing email in account management. Stripe delivers the payment again
                for up to three days, and the next delivery sends the confirmation to it.
              </p>
            ) : o.candidates.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-[var(--secondary)]">
                Neither the order&apos;s client nor the paying address has an account to attach it to.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {o.candidates.map((c) => (
                  <li key={c.accountId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[13.5px] text-[var(--ink)]">
                      {c.name}&apos;s account, {c.status}, offered as {c.because}
                    </span>
                    {canAttach ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => attach(o.orderId, c.accountId)}
                        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-45"
                      >
                        {busy === `${o.orderId}:${c.accountId}` ? "Attaching" : "Attach to this account"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {canAttach ? null : (
        <p className="mt-3 text-[13.5px] text-[var(--secondary)]">
          Attaching an order to an account needs the permission to manage accounts.
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-3 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 rounded-[3px] bg-[var(--green-bg)] px-3 py-2 text-[13.5px] text-[var(--green)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
