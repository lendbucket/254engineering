"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";
import { toneFor } from "@/lib/order-attention";
import type { OrderNeedingAttention } from "@/lib/ops-reconcile";
import { Chip } from "@/components/portal/surfaces";

type Finding = {
  reference: string;
  verdict: string;
  action: string;
  detail: string;
  providerAmountCents: number | null;
};

/**
 * The two things a person can do about a stuck order.
 *
 * ASKING IS SEPARATE FROM ACTING, AND ALWAYS FIRST
 * ------------------------------------------------
 * "Ask the provider" runs the reconciler read only and shows what it found.
 * Nothing is written. Only after the answer is on screen does "Record what the
 * provider says" appear, and it applies exactly what was shown.
 *
 * That split is not politeness. The reconciler can record a payment and release
 * work off the back of it, and a button that does that before anybody has read
 * the finding is a button that will one day be pressed on a wrong answer.
 *
 * A REFUND NEEDS A SENTENCE
 * -------------------------
 * Every other refund in this platform is the consequence of an engineer's
 * decision, which is itself recorded. This one has no such record, so the
 * reason somebody types is the only explanation that will exist in a year. The
 * server enforces the minimum too; the counter here is so nobody discovers that
 * after writing.
 */
export function OrdersClient({
  orders,
  canRefund,
}: {
  orders: OrderNeedingAttention[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const references = orders.map((o) => o.reference);

  async function ask(apply: boolean) {
    setBusy(apply ? "apply" : "ask");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/orders/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply, references }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The provider could not be asked.");
        return;
      }
      setFindings(data.findings ?? []);
      if (apply) {
        setNote("Recorded. Anything that was paid has been written to the ledger and released.");
        router.refresh();
      }
    } catch {
      setError("The request did not complete. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  async function refund(orderId: string) {
    setBusy(orderId);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The refund did not go through.");
        return;
      }
      setNote(
        data.refundedCents > 0
          ? `Cancelled and refunded ${money(data.refundedCents)}.`
          : "Cancelled. Nothing had been charged, so nothing was refunded.",
      );
      setRefunding(null);
      setReason("");
      router.refresh();
    } catch {
      setError("The request did not complete. Check the order before trying again.");
    } finally {
      setBusy(null);
    }
  }

  const answered = new Map((findings ?? []).map((f) => [f.reference, f]));
  const anythingPaid = (findings ?? []).some((f) => f.verdict === "paid_unrecorded");

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {orders.map((o) => {
          const found = answered.get(o.reference);
          return (
            <li key={o.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[13px] font-semibold text-slate">{o.reference}</span>
                <Chip label={o.attention.label} tone={toneFor(o.attention.level)} />
                <span className="ml-auto text-[13.5px] font-semibold text-slate">{money(o.totalCents)}</span>
              </div>
              <p className="mt-1 text-[13px] text-slate-muted">
                {o.propertyAddress} for {o.customerEmail}
              </p>
              <p className="mt-1.5 max-w-[76ch] text-[13px] leading-[1.6] text-slate-muted">
                {o.attention.detail}
              </p>

              {found ? (
                <p
                  className={`mt-2 max-w-[76ch] rounded-[3px] px-3 py-2 text-[13px] leading-[1.6] ${
                    found.verdict === "paid_unrecorded"
                      ? "bg-[#fdf3e0] text-[#7a4c05]"
                      : "bg-limestone text-slate-muted"
                  }`}
                >
                  <span className="font-semibold">The provider says:</span> {found.detail}
                </p>
              ) : null}

              {canRefund ? (
                refunding === o.id ? (
                  <div className="mt-3 max-w-[76ch] rounded-[4px] border border-limestone-line bg-white p-3">
                    <label
                      htmlFor={`reason-${o.id}`}
                      className="block text-[12px] font-bold tracking-[0.08em] text-slate uppercase"
                    >
                      Why is the firm cancelling this?
                    </label>
                    <p className="mt-1 text-[12.5px] leading-[1.55] text-slate-muted">
                      This refunds everything, including any inspection that already happened, and is recorded
                      against you rather than against an engineer. It is the only refund with no engineering
                      decision behind it, so this sentence is the only record of why.
                    </p>
                    <textarea
                      id={`reason-${o.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      className="mt-2 w-full rounded-[3px] border border-limestone-line px-2.5 py-2 text-[13.5px] text-slate"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy !== null || reason.trim().length < 10}
                        onClick={() => refund(o.id)}
                        className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13px] font-bold text-white disabled:opacity-45"
                      >
                        {busy === o.id ? "Refunding" : "Cancel and refund in full"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRefunding(null);
                          setReason("");
                        }}
                        className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-slate-muted underline"
                      >
                        Leave it
                      </button>
                      <span className="text-[12px] text-slate-muted">
                        {reason.trim().length < 10 ? "A reason is required." : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRefunding(o.id)}
                    className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-slate underline underline-offset-2"
                  >
                    Cancel and refund this order
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-limestone-line pt-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => ask(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] bg-brass px-4 text-[13px] font-bold text-slate-ink disabled:opacity-45"
        >
          {busy === "ask" ? "Asking" : "Ask the provider what happened"}
        </button>

        {findings !== null && anythingPaid ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => ask(true)}
            className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13px] font-bold text-white disabled:opacity-45"
          >
            {busy === "apply" ? "Recording" : "Record what the provider says"}
          </button>
        ) : null}

        {findings !== null && !anythingPaid ? (
          <span className="text-[13px] text-slate-muted">
            Nothing here was paid for, so there is nothing to record.
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-[3px] bg-[#fdecec] px-3 py-2 text-[13px] text-[#8a1f1f]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 rounded-[3px] bg-[#eef6ee] px-3 py-2 text-[13px] text-[#22551f]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
