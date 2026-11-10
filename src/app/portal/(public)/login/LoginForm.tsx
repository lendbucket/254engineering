"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canKeepSignIn, resumeKeptSignIn } from "@/lib/native-shell";
import {
  ForgotPasswordLink,
  PasswordField,
  SIGN_IN_INPUT,
  SIGN_IN_LABEL,
  SignInButton,
  SignInError,
} from "@/components/portal/SignInFields";

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
 *
 * THE 2026-11-08 REDESIGN IS PRESENTATION ONLY (Robert: "a visual change
 * only"). The endpoint, the body, safeNext, the redirect the server names (the
 * second factor step among them) and both attributes above are unchanged. What
 * moved: the shared field parts, a show and hide toggle on the password, and
 * the administrator sentence under the button, which the order removes. The
 * two fallback errors now say what failed.
 */

function safeNext(next: string | null): string {
  if (!next) return "";
  // Only ever a path on this site. An open redirect out of a sign in screen is a
  // phishing primitive: the attacker sends a real link to a real login.
  if (!next.startsWith("/portal") || next.startsWith("//")) return "";
  return next;
}

export function LoginForm({
  next,
  disabled,
  forgotHref,
}: {
  next: string | null;
  disabled: boolean;
  /** The reset flow, when staff have one. Absent, no link is drawn. */
  forgotHref?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = safeNext(next);

  /*
   * INSIDE THE STORE APP, A KEPT SIGN IN IS TRIED FIRST (0125; Robert's answer
   * of 2026-11-10, 6766967932). The phone's keystore token is traded for a
   * fresh session; if the server refuses it, the token is forgotten and this
   * form is the answer, exactly as in a browser, where nothing here runs.
   */
  useEffect(() => {
    if (disabled || !canKeepSignIn()) return;
    let live = true;
    setBusy(true);
    void resumeKeptSignIn().then((redirect) => {
      if (!live) return;
      if (redirect) {
        router.push(target || redirect);
        router.refresh();
        return;
      }
      setBusy(false);
    });
    return () => {
      live = false;
    };
  }, [disabled, router, target]);

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
        setError(body?.error ?? "Sign in failed, and the server did not say why. Try again.");
        setBusy(false);
        return;
      }
      router.push(body.redirect ?? "/portal");
      router.refresh();
    } catch {
      setError("Sign in did not reach the server. Check the connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/api/portal/session" noValidate className="mt-7">
      <input type="hidden" name="next" value={target} />

      <label htmlFor="email" className={SIGN_IN_LABEL}>
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
        className={SIGN_IN_INPUT}
      />

      <PasswordField id="password" name="password" value={password} onChange={setPassword} disabled={disabled} />

      <SignInError message={error} />

      <SignInButton busy={busy} disabled={disabled} />

      {forgotHref ? <ForgotPasswordLink href={forgotHref} /> : null}
    </form>
  );
}
