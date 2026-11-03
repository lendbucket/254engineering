"use client";

import { useState } from "react";

/**
 * "Sign out everywhere", auth M2 (Robert, 2026-11-02, option A). Ends every
 * session this account holds, on every device, this one included, by moving the
 * profile's session epoch. For a phone left somewhere or a session you do not
 * recognise. Changing your password does this too, and keeps this tab signed in.
 */
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign_out_everywhere" }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "Your sessions could not be ended. Nothing was changed.");
        setBusy(false);
        return;
      }
      window.location.assign("/portal/login");
    } catch {
      setError("The network dropped that. Your sessions may not have been ended; try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[14px] leading-[1.6] text-[var(--secondary)]">
        Ends every session on this account, on every device, including this one. You will sign in again here.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mt-4 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)] disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {busy ? "Signing out everywhere..." : "Sign out everywhere"}
      </button>
    </div>
  );
}
