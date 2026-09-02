"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The portal sign in form.
 *
 * method="post" AND action ARE NOT DECORATION
 * -------------------------------------------
 * The admin login shipped once with neither. A submit before React hydrated was
 * therefore a native GET, and the password went into the query string, into
 * browser history, into the server log, and into the next request's Referer
 * header. It was found on the live site and not on localhost, because a real
 * network is slow enough for a person to submit before hydration.
 *
 * These two attributes mean the pre-hydration submit is a POST to the same
 * endpoint the fetch below uses, which is a working sign in rather than a
 * credential leak. scripts/security-audit.mjs asserts both, from the rendered
 * page, so they cannot be removed by a tidy up.
 */

function safeNext(next: string | null): string {
  if (!next) return "";
  // Only ever a path on this site. An open redirect out of a sign in screen is a
  // phishing primitive: the attacker sends a real link to a real login.
  if (!next.startsWith("/portal") || next.startsWith("//")) return "";
  return next;
}

export function LoginForm({ next, disabled }: { next: string | null; disabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = safeNext(next);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: target }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; redirect?: string }
        | null;

      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work. Try again.");
        setBusy(false);
        return;
      }
      router.push(body.redirect ?? "/portal");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/api/portal/session" noValidate className="mt-7">
      <input type="hidden" name="next" value={target} />

      <label htmlFor="email" className="block text-[13px] font-semibold text-slate">
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
        /* 16px, so iOS does not zoom the page on focus and leave it panned. */
        className="mt-1.5 min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate"
      />

      <label htmlFor="password" className="mt-4 block text-[13px] font-semibold text-slate">
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
        className="mt-1.5 min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate"
      />

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] border border-[#f3c9c6] bg-[#fdeceb] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[#8c1d18]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || disabled}
        className="mt-6 min-h-[48px] w-full rounded-[3px] bg-brass px-4 text-[15px] font-bold text-slate-ink transition-colors hover:bg-brass-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>

      <p className="mt-5 text-[13px] leading-[1.6] text-slate-muted">
        Accounts are created by an administrator. If you have lost your password, ask them to send a
        reset link.
      </p>
    </form>
  );
}
