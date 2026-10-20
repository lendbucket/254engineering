"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/** Approve or decline one request, with an optional note. Approving moves money, so it asks first. */
export function DecideRefund({ requestId, reference, owed }: { requestId: string; reference: string; owed: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(decision: "approved" | "declined") {
    if (decision === "approved" && !window.confirm(`Refund ${owed} on ${reference} to the customer's card? This cancels the order.`)) return;
    setBusy(true);
    setError(null);
    const result = await postJson("/api/portal/refunds", { action: "decide", requestId, decision, note: note || null });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(decision === "approved" ? "Approved and refunded." : "Declined.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`note-${requestId}`} className={labelClass}>Note, if any</label>
      <input id={`note-${requestId}`} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={primaryClass} onClick={() => void decide("approved")}>Approve and refund</button>
        <button type="button" disabled={busy} className={ghostClass} onClick={() => void decide("declined")}>Decline</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

/** The operator's limit, set in dollars. */
export function RefundLimitForm({ currentDollars }: { currentDollars: number }) {
  const router = useRouter();
  const [dollars, setDollars] = useState(String(currentDollars));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/refunds", { action: "set_limit", dollars: Number(dollars), reason: reason || null });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("The limit is saved. It applies to the next decision.");
        router.refresh();
      }}
    >
      <div className="w-[180px]">
        <label htmlFor="limit-dollars" className={labelClass}>Limit, in dollars</label>
        <input id="limit-dollars" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <div className="min-w-[240px] flex-1">
        <label htmlFor="limit-reason" className={labelClass}>Why, for the record</label>
        <input id="limit-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving" : "Save the limit"}</button>
      <div className="w-full"><Problem message={error} /><Done message={done} /></div>
    </form>
  );
}

/** Ask for an order's money to go back, from the order's own screen. */
export function RequestRefund({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/refunds", { action: "request", orderId, reason });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Asked. Somebody who can approve it will decide, and the request is on the refund requests screen until they do.");
        setReason("");
        router.refresh();
      }}
    >
      <label htmlFor={`refund-${orderId}`} className={labelClass}>Why the money should go back</label>
      <textarea id={`refund-${orderId}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} py-2`} />
      <div><button type="submit" disabled={busy} className={ghostClass}>{busy ? "Asking" : "Ask for a refund"}</button></div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}
