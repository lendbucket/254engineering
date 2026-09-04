"use client";

import { useState } from "react";

/**
 * Changing your own password.
 *
 * The current password is required, so a session left open on a shared machine
 * cannot be used to lock the owner out of their own account.
 */
export function PasswordForm({ minLength }: { minLength: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const field =
    "mt-1.5 min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";
  const label = "block text-[13.5px] font-semibold text-[var(--navy)]";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const next = String(form.get("next") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/portal/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: form.get("current"), next }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      e.currentTarget.reset();
    } catch {
      setError("The network dropped that.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor="current" className={label}>Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={field} />
      </div>
      <div className="mt-4">
        <label htmlFor="next" className={label}>New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={minLength} className={field} />
        <p className="mt-1.5 text-[12.5px] text-[var(--secondary)]">At least {minLength} characters.</p>
      </div>
      <div className="mt-4">
        <label htmlFor="confirm" className={label}>Type the new one again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={field} />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-4 rounded-[3px] border border-[var(--green-border)] bg-[var(--green-bg)] px-3 py-2.5 text-[13.5px] text-[var(--green)]">
          Your password is changed.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {busy ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
