"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The partner sign in form.
 *
 * method="post" AND action ARE NOT DECORATION
 * -------------------------------------------
 * The same lesson the staff form carries, and it is repeated here rather than
 * assumed: without them, a submit before React hydrates is a native GET and the
 * password goes into the query string, into browser history, into the server
 * log, and into the next request's Referer header. It was found on the live
 * site once and not on localhost, because a real network is slow enough for a
 * person to submit before hydration.
 *
 * security-audit asserts both from the rendered page, so a tidy up cannot
 * remove them.
 */
export function PartnerLoginForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; redirect?: string }
        | null;

      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work. Try again.");
        setBusy(false);
        return;
      }
      router.push(body.redirect ?? "/partner");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/api/partner/session" noValidate className="mt-7">
      <label htmlFor="email" className="block text-[13.5px] font-semibold text-[var(--ink)]">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={disabled}
        /* 16px so iOS does not zoom the page on focus and leave it panned. */
        className="mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]"
      />

      <label htmlFor="password" className="mt-4 block text-[13.5px] font-semibold text-[var(--ink)]">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={disabled}
        className="mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]"
      />

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
        disabled={busy || disabled}
        className="mt-6 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "Signing in" : "Sign in"}
      </button>

      <p className="mt-5 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        Partner accounts are created by the firm. There is no sign up here, and if you have lost
        your password, ask the firm to send a new link.
      </p>
    </form>
  );
}
