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
        /*
         * 16px, so iOS does not zoom the page on focus and leave it panned.
         *
         * It is not on the standards file's type scale, and it is the one place
         * that is correct: the scale is about hierarchy, and this is about a
         * platform behaviour. token-audit allows 16 for exactly this reason.
         */
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

      {/*
        THE BUTTON WAS GOLD AND IS NOW NAVY.

        The standards file is explicit twice over: the primary button is navy
        with white text, and gold appears only in the logo, warnings, pending
        states and the active nav bar. A gold sign in button is gold as
        decoration, which is the one use the palette rules out.

        This is presentation. Nothing about what the button does changed.
      */}
      <button
        type="submit"
        disabled={busy || disabled}
        className="mt-6 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "Signing in" : "Sign in"}
      </button>

      <p className="mt-5 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        Accounts are created by an administrator. If you have lost your password, ask them to send a
        reset link.
      </p>
    </form>
  );
}
