"use client";

import { useState } from "react";
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
      <label htmlFor="email" className="block text-[13.5px] font-bold text-[var(--navy)]">
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

      <label htmlFor="password" className="mt-4 block text-[13.5px] font-bold text-[var(--navy)]">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[15px] text-[var(--navy)]"
      />

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[3px] bg-slate px-5 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
