"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Choosing a password behind a one time link.
 *
 * The two field confirmation is here for the reason the staff form records: this
 * is the one moment a typo is unrecoverable without another link. Everywhere
 * else a wrong password costs a retry; here it locks somebody out of an account
 * they have never used.
 */
export function PartnerSetPasswordForm({ token, minLength }: { token: string; minLength: number }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < minLength;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("Those two do not match.");
      return;
    }
    if (password.length < minLength) {
      setError(`Choose at least ${minLength} characters.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      router.push("/partner/login?set=1");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]";

  return (
    <form onSubmit={onSubmit} method="post" action="/api/partner/set-password" noValidate className="mt-6">
      <input type="hidden" name="token" value={token} />

      <label htmlFor="password" className="block text-[13.5px] font-semibold text-[var(--ink)]">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={minLength}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-describedby="password-hint"
        className={field}
      />
      <p id="password-hint" className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
        At least {minLength} characters.
        {tooShort ? ` That is ${password.length}.` : ""}
      </p>

      <label htmlFor="confirm" className="mt-4 block text-[13.5px] font-semibold text-[var(--ink)]">
        Again
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={field}
      />
      {mismatch ? (
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--red)]">Those two do not match.</p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "Setting" : "Set password"}
      </button>
    </form>
  );
}
