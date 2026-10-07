"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE ENGINEER'S DECISION ON A JOB HELD BEFORE DISPATCH. Operator ruling 1 of
 * 2026-10-07: accept releases the hold; decline needs his referral, closes the
 * file and refunds the customer in full, because nobody has attended. Nothing
 * here decides for him: a standing ruling is shown on the page beside its
 * question, and the choice and the words are his.
 */
export function PrereviewPanel({ fileId, fileNumber }: { fileId: string; fileNumber: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prereview", fileId, decision, note }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) setError(out.error ?? "That was not recorded.");
      else router.refresh();
    } catch {
      setError("That was not recorded, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label htmlFor={`prereview-${fileId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
        Your note on {fileNumber}. A decline needs the referral: where the customer should go instead.
      </label>
      <textarea
        id={`prereview-${fileId}`}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2 text-[14px] text-[var(--ink)]"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("accept")}
          className="min-h-[44px] rounded-[3px] bg-[var(--navy)] px-5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          Accept, release for dispatch
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("decline")}
          className="min-h-[44px] rounded-[3px] border border-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-40"
        >
          Decline with this referral
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
