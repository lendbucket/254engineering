"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Customer sign in.
 *
 * The error is whatever the server said, rendered verbatim and once. The server
 * returns one message for every kind of failure on purpose, so there is nothing
 * here that could accidentally distinguish them by branching on a status code.
 */
export function AccountLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      router.push(next || data.redirect || "/account");
      router.refresh();
    } catch {
      setError("The request did not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="email" className="block text-[14px] font-bold text-[var(--navy)]">
        Email address
      </label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[15px] text-[var(--navy)]"
      />

      {/*
        THE LABEL AND THE WAY OUT SIT ON ONE LINE, which is where a person
        looks for it: beside the field they have just failed to fill in
        correctly, rather than below the button they are about to press.
      */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <label htmlFor="password" className="block text-[14px] font-bold text-[var(--navy)]">
          Password
        </label>
        <Link
          href="/account/forgot-password"
          prefetch={false}
          className="text-[13px] text-[var(--navy)] underline underline-offset-2"
        >
          Forgot password?
        </Link>
      </div>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[15px] text-[var(--navy)]"
      />

      {/* Ink, not red, and no tint. See the note on the sign up form for why. */}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 border-l-2 border-[var(--color-ink)] pl-3 text-[14px] leading-[1.6] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[3px] bg-slate px-5 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
