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
        className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13px] font-bold text-white disabled:opacity-45"
      >
        {busy ? "Opening" : "Pay this statement"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[#8a1f1f]">
          {error}
        </p>
      ) : null}
    </>
  );
}
