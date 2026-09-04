"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Accept and decline.
 *
 * DECLINE ASKS WHY, AND DOES NOT INSIST
 * -------------------------------------
 * The reason goes on the file's timeline, because dispatch is a person deciding
 * who to call next and "three people turned this down, all of them said it is a
 * four hour drive" is the fact that decision needs. It is optional, because a
 * required reason produces the word "no" three hundred times and teaches
 * everyone that the field is furniture.
 *
 * A LOST RACE IS EXPLAINED, NOT SWALLOWED
 * ---------------------------------------
 * Several technicians hold the same offer. When somebody else accepts first
 * this returns the refusal from canRespondToOffer verbatim, which says exactly
 * that. A silent failure here would have somebody driving to a job that is not
 * theirs.
 */
export function OfferControls({ offerId, fileId }: { offerId: string; fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  async function respond(action: "accept_offer" | "decline_offer") {
    setBusy(action === "accept_offer" ? "accept" : "decline");
    setError(null);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId, reason: reason.trim() || null }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(null);
        return;
      }
      if (action === "accept_offer") {
        router.push(`/portal/jobs/${fileId}`);
      }
      router.refresh();
    } catch {
      setError("The network dropped that. Try again when you have signal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="mb-3 text-[13.5px] leading-[1.5] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      {declining ? (
        <div>
          <label htmlFor={`why-${offerId}`} className="block text-[13.5px] font-semibold text-[var(--navy)]">
            Why, so dispatch knows who to call next (optional)
          </label>
          <input
            id={`why-${offerId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Too far, already booked that day"
            className="mt-1.5 min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => respond("decline_offer")}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[3px] border border-[var(--border)] px-4 text-[15px] font-bold text-[var(--navy)] disabled:opacity-50"
            >
              {busy === "decline" ? "Sending" : "Confirm decline"}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[3px] px-4 text-[15px] font-semibold text-[var(--secondary)]"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => respond("accept_offer")}
            className="inline-flex min-h-[var(--tap-target)] flex-1 items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-50"
          >
            {busy === "accept" ? "Accepting" : "Accept this job"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setDeclining(true)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[3px] border border-[var(--border)] px-4 text-[15px] font-semibold text-[var(--navy)]"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
