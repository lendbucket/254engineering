"use client";

import { useState } from "react";

/**
 * "Sign out everywhere" on the customer account screen, auth M2 (Robert,
 * 2026-11-02, option A). Moves the user's session epoch, so every session on
 * every device ends, this one included.
 */
export function SignOutEverywhereButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error ? (
        <p role="alert" className="mt-3 text-[15px] font-semibold text-[var(--color-ink)]">
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
            const res = await fetch("/api/account/session?scope=everywhere", { method: "DELETE" });
            const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.error ?? "Your other sessions could not be ended. Try again.");
              setBusy(false);
              return;
            }
            window.location.assign("/account/login");
          } catch {
            setError("The network dropped that. Your sessions may not have been ended; try again.");
            setBusy(false);
          }
        }}
        className="mt-4 inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--color-link)] disabled:opacity-50"
      >
        {busy ? "Signing out everywhere" : "Sign out everywhere"}
      </button>
    </div>
  );
}
