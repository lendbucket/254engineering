"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Record a payment received outside the platform, on this job (0138). The
 * administrator alone (payments.record_outside). Robert's answers 2, 3 and 5 of
 * the night of 2026-11-18: the amount must equal the job's total, and the
 * server refuses anything else, naming the figure to fix.
 *
 * Opened by a button rather than shown open, because it is rare and it moves
 * money on the record: the form should be something somebody chooses to open.
 */
export function RecordOutsidePayment({ fileId, total }: { fileId: string; total: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const field = "h-11 rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] font-normal";
  const label = "flex min-w-0 flex-col gap-1 text-[14px] font-semibold text-[var(--ink)]";
  const button =
    "inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50";

  if (!open) {
    return (
      <div className="mt-2">
        <button type="button" onClick={() => setOpen(true)} className={button}>
          Record a payment made outside the platform
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-[14px] text-[var(--secondary)]">
        For a payment that reached Stripe without this job&apos;s payment link, such as a dashboard invoice. The amount must be this
        job&apos;s total, {total}. The refund terms are recorded on the order as stated after payment.
      </p>
      <div className="flex flex-wrap gap-2">
        <label className={label}>
          Amount paid, in dollars
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${field} w-[140px]`} />
        </label>
        <label className={label}>
          Date paid
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={field} />
        </label>
        <label className={`${label} flex-1`}>
          Stripe invoice number or payment reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
        </label>
      </div>
      <label className={label}>
        Why it was paid outside the platform
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setSaid(null);
            try {
              const res = await fetch("/api/portal/files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "record_outside_payment", fileId, amount, reference, paidOn, reason }),
              });
              const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; reference?: string } | null;
              if (!res.ok || !body?.ok) {
                setSaid({ ok: false, text: body?.error ?? "That did not work. Nothing was recorded." });
                return;
              }
              setSaid({ ok: true, text: `Recorded on ${body.reference ?? "the order"}.` });
              router.refresh();
            } catch {
              setSaid({ ok: false, text: "The network dropped that. Check the file before trying again." });
            } finally {
              setBusy(false);
            }
          }}
          className={button}
        >
          {busy ? "Recording" : "Record the payment"}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className={button}>
          Cancel
        </button>
      </div>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
