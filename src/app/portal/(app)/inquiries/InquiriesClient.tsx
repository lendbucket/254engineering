"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recording that somebody answered a brief.
 *
 * IT RECORDS A REPLY RATHER THAN SENDING ONE. Design work cannot be scoped from
 * a form, so the reply is a person writing to another person, and a button that
 * offered to send it would be offering to write an engineering opinion from a
 * dropdown. This marks that the conversation happened, which is the fact
 * `responded_at` exists to hold.
 */
export function MarkAnswered({ inquiryId, name }: { inquiryId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      {error ? (
        <p role="alert" className="mb-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/portal/inquiries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_answered", inquiryId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.error ?? "That did not work.");
              return;
            }
            router.refresh();
          } catch {
            setError("The network dropped that. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Recording" : `I have replied to ${name.split(" ")[0]}`}
      </button>
    </div>
  );
}

/**
 * Start a quote from this brief. Robert's answer 2 of 2026-10-27.
 *
 * The person starting it picks which of the design line's quoted deliverables
 * it is, because the brief's own answer does not name one (startQuoteFromBrief
 * says why). Nothing is sent to the customer: the request lands on
 * /portal/quotes to be priced and sent from there, like any other.
 */
export function StartQuote({ inquiryId, options }: { inquiryId: string; options: { tier: string; name: string }[] }) {
  const router = useRouter();
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = `quote-tier-${inquiryId}`;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      {error ? (
        <p role="alert" className="w-full text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <label htmlFor={selectId} className="flex flex-col text-[13.5px] text-[var(--navy)]">
        Quote this brief as
        <select
          id={selectId}
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="mt-1 min-h-[44px] rounded-[3px] border border-[var(--border)] bg-white px-2 text-[13.5px]"
        >
          <option value="">Choose a design deliverable</option>
          {options.map((o) => (
            <option key={o.tier} value={o.tier}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || !tier}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/portal/inquiries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "start_quote", inquiryId, tier }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.error ?? "That did not work.");
              return;
            }
            router.refresh();
          } catch {
            setError("The network dropped that. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Starting" : "Start a quote from this brief"}
      </button>
    </div>
  );
}
