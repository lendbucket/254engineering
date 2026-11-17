"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  reference: string;
  county: string;
  propertyAddress: string;
  deliverable: string;
  customerName: string;
  letter: string;
  waiting: string;
};

/**
 * ONLINE ORDERS WAITING FOR TRAVEL, AND THE ONE ACTION THAT ANSWERS THEM.
 * Robert's add-on of 2026-11-16 and his answer 12: the administrator sets
 * travel, and the customer's payment link, letter plus travel, goes by itself.
 * The amount is typed in dollars and sent in whole cents; the reason is for
 * staff and the customer never sees it.
 */
export function TravelHoldsClient({ rows, canSet }: { rows: Row[]; canSet: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function setTravel(id: string) {
    const dollars = Number((amount[id] ?? "").replace(/[$,\s]/g, ""));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Type the travel amount in dollars, above zero.");
      return;
    }
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/orders/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, travelCents: Math.round(dollars * 100), reason: reason[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Travel was not set.");
        return;
      }
      setNote(
        data.emailed
          ? `Travel set on ${data.reference}. The customer's payment link has gone.`
          : `Travel set on ${data.reference}. The payment link could not be emailed; send it again from the order.`,
      );
      router.refresh();
    } catch {
      setError("The request did not complete. Check the order before trying again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {rows.map((r) => (
          <li key={r.id} className="py-4">
            <p className="text-[15px] font-semibold text-[var(--ink)]">
              {r.reference}, {r.county} County
            </p>
            <p className="mt-1 text-[13.5px] text-[var(--ink)]">
              {r.deliverable} at {r.propertyAddress}, for {r.customerName || "no name given"}. Letter {r.letter}. Waiting {r.waiting}.
            </p>
            {canSet ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-[12.5px] text-[var(--ink)]">
                  Travel, in dollars
                  <input
                    inputMode="decimal"
                    className="min-h-[44px] w-[120px] border border-limestone-line px-3 text-[15px]"
                    value={amount[r.id] ?? ""}
                    onChange={(e) => setAmount({ ...amount, [r.id]: e.target.value })}
                  />
                </label>
                <label className="grid min-w-0 flex-1 gap-1 text-[12.5px] text-[var(--ink)]">
                  Why this amount (staff only)
                  <input
                    className="min-h-[44px] border border-limestone-line px-3 text-[15px]"
                    value={reason[r.id] ?? ""}
                    onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => setTravel(r.id)}
                  className="min-h-[44px] bg-[var(--navy)] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
                >
                  {busy === r.id ? "Setting travel" : "Set travel and send the link"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--ink)]">An administrator sets travel on this order.</p>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 text-[13.5px] text-[var(--ink)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
