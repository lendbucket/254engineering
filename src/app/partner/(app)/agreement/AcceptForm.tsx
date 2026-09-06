"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Accepting the programme agreement.
 *
 * THE VERSION GOES WITH THE ACCEPTANCE
 * ------------------------------------
 * A page left open in a tab while the firm publishes a new agreement would
 * otherwise record acceptance of a document that is no longer the agreement.
 * The server compares the version it was sent against the current one and
 * refuses a stale acceptance, which is exactly what the versioning is for.
 */
export function AcceptForm({ version }: { version: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not go through. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      >
        {busy ? "Recording" : `Accept version ${version}`}
      </button>

      <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        Accepting records who accepted, when, and from where. That record cannot be edited or
        deleted afterwards, by anybody, including the firm.
      </p>
    </div>
  );
}
