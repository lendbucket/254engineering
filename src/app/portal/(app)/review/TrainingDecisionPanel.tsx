"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE ENGINEER'S DECISION ON A CERTIFICATION FROM SUPERVISED TRAINING.
 * Operator ruling of 2026-10-07: approval makes the technician certified for
 * dispatch; a refusal needs his reason and certifies nothing. decideTraining on
 * the server checks that the session is the engineer of record's.
 */
export function TrainingDecisionPanel({ recordId, technician }: { recordId: number; technician: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "refuse") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "training_decision", recordId, decision, reason }),
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
      <label htmlFor={`training-${recordId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
        Your reason, if you refuse {technician}&apos;s certification
      </label>
      <textarea
        id={`training-${recordId}`}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-2 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2 text-[14px] text-[var(--ink)]"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("approve")}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          Approve, certify for dispatch
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("refuse")}
          className="min-h-[44px] rounded-[2px] border border-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-40"
        >
          Refuse with this reason
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
