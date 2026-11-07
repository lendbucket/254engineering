"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * APPROVE OR DECLINE: ONE CLICK EACH, AND A REASON. Robert, 2026-11-05.
 *
 * The reason is the firm's record and is never sent to the roofer. Both
 * buttons stay disabled until a reason is written, so a click without one is
 * not possible rather than refused after the fact. Approve makes the account
 * a partner (since 0117 the account opened at sign up; an older application's
 * opens through door 2 and gets the set password link); decline emails one
 * plain note. Either is final: the table refuses a second decision.
 */
export function RooferDecision({ id, company }: { id: string; company: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = reason.trim().length >= 3 && busy === null;

  async function decide(action: "approve" | "decline") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/portal/roofer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, reason }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That was not recorded. Nothing has changed; try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("The connection dropped before an answer came back. Reload the page to see whether it was recorded before trying again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="print:hidden">
      <label htmlFor="roofer-reason" className="block text-[14px] font-semibold text-[var(--ink)]">
        Reason for the decision
      </label>
      <p id="roofer-reason-hint" className="mt-1 text-[13px] text-[var(--secondary)]">
        Kept on the firm&apos;s record with your name. It is not sent to {company}.
      </p>
      <textarea
        id="roofer-reason"
        aria-describedby="roofer-reason-hint"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={2000}
        className="mt-2 block w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2 text-[15px] text-[var(--ink)]"
      />
      {error ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void decide("approve")}
          className="inline-flex min-h-[44px] items-center rounded-[3px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "approve" ? "Approving" : "Approve the partner account"}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void decide("decline")}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
        >
          {busy === "decline" ? "Recording" : "Decline"}
        </button>
      </div>
    </div>
  );
}

export function PrintThis() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[14px] font-semibold text-[var(--navy)] print:hidden"
    >
      Print
    </button>
  );
}
