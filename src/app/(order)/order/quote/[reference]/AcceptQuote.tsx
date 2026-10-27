"use client";

import { useState } from "react";

/**
 * Accept the quote and go to payment. The server reads the engineer's signed
 * record, refuses a lapsed quote and opens the platform's one checkout; this
 * only asks and follows the link it is given. Nothing is charged here.
 */
export function AcceptQuote({ token, amount, again = false }: { token: string; amount: string; again?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/quote-accept", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; checkoutUrl?: string; error?: string } | null;
            if (body?.ok && body.checkoutUrl) {
              window.location.assign(body.checkoutUrl);
              return;
            }
            setError(body?.error ?? "The quote could not be accepted just now. Nothing has been charged. Try again in a few minutes.");
          } catch {
            setError("The quote could not be accepted just now. Nothing has been charged. Try again in a few minutes.");
          }
          setBusy(false);
        }}
        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white disabled:opacity-70"
      >
        {busy ? "Opening payment" : again ? "Continue to payment" : `Accept and pay ${amount}`}
      </button>
      <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
        Card details are entered on the payment provider&apos;s page and never reach this firm. Nothing is charged until you complete it.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[15px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
