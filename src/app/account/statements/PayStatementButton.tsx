"use client";

import { useState } from "react";

export function PayStatementButton({ statementId }: { statementId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/account/statements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "pay", statementId }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
              setError(data.error ?? "That did not work.");
              return;
            }
            window.location.href = data.checkoutUrl;
          } catch {
            setError("The request did not complete. Nothing was charged.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[14px] font-bold text-white disabled:opacity-45"
      >
        {busy ? "Opening" : "Pay this statement"}
      </button>
      {/*
        Ink, not red, and this one is about money: it is the sentence somebody
        sees when paying a statement failed. Weight 600 behind an ink rule, so it
        does not read as body copy without using a colour the spec forbids. See
        the note on the sign up form.
      */}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-2 border-l-2 border-[var(--color-ink)] pl-3 text-[14px] leading-[1.6] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
