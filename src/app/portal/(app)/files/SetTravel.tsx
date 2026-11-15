"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Travel on a job, set by the administrator before its payment link (0135).
 * setTravel decides everything on the server: the permission, the reason and
 * that no link has gone out.
 */
export function SetTravel({ fileId, current }: { fileId: string; current: { cents: number; reason: string } | null }) {
  const router = useRouter();
  const [amount, setAmount] = useState(current ? String(current.cents / 100) : "");
  const [reason, setReason] = useState(current?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(clear: boolean) {
    setBusy(true);
    setSaid(null);
    try {
      const cents = clear || !amount.trim() ? null : Math.round(Number(amount) * 100);
      if (cents !== null && (!Number.isFinite(cents) || cents <= 0)) {
        setSaid({ ok: false, text: "Type the travel as a plain number of dollars above zero, such as 85 or 85.50." });
        return;
      }
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_travel", fileId, travelCents: cents, reason }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; answered?: boolean } | null;
      if (!res.ok || !body?.ok) {
        setSaid({ ok: false, text: body?.error ?? "That did not save. Nothing was changed." });
        return;
      }
      setSaid({
        ok: true,
        text:
          cents === null
            ? "Travel cleared."
            : body.answered
              ? "Travel saved. It was asked for, so the payment link has been sent and whoever asked has a task saying so."
              : "Travel saved. It goes on the payment link as its own line.",
      });
      router.refresh();
    } catch {
      setSaid({ ok: false, text: "The network dropped that. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[14px] font-semibold text-[var(--ink)]">
          Travel
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 w-[140px] rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] font-normal"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[14px] font-semibold text-[var(--ink)]">
          Why, for staff only
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] font-normal"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(false)}
          className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
        >
          {busy ? "Saving" : "Save the travel"}
        </button>
        {current ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
          >
            Clear the travel
          </button>
        ) : null}
      </div>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
