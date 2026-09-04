"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Choosing a password behind a one time link.
 *
 * The two field confirmation is here because this is the one moment a typo is
 * unrecoverable without another link. Everywhere else a wrong password is one
 * retry; here it locks the person out of an account they have never used.
 */
export function SetPasswordForm({ token, minLength }: { token: string; minLength: number }) {
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
      const res = await fetch("/api/portal/set-password", {
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
      router.push("/portal/login?reset=1");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";

  return (
    <form onSubmit={onSubmit} method="post" action="/api/portal/set-password" noValidate className="mt-6">
      <input type="hidden" name="token" value={token} />

      <label htmlFor="password" className="block text-[13px] font-semibold text-slate">
        New password
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
      <p id="password-hint" className={`mt-1.5 text-[12.5px] ${tooShort ? "text-[#8c1d18]" : "text-slate-muted"}`}>
        At least {minLength} characters. Nobody at the firm can see it, including whoever created
        your account.
      </p>

      <label htmlFor="confirm" className="mt-4 block text-[13px] font-semibold text-slate">
        Type it again
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
      {mismatch ? <p className="mt-1.5 text-[12.5px] text-[#8c1d18]">Those two do not match yet.</p> : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] border border-[#f3c9c6] bg-[#fdeceb] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[#8c1d18]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving..." : "Set my password"}
      </button>
    </form>
  );
}
