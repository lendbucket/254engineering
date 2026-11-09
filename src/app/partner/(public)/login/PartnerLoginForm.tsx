"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ForgotPasswordLink,
  PasswordField,
  SIGN_IN_INPUT,
  SIGN_IN_LABEL,
  SignInButton,
  SignInError,
} from "@/components/portal/SignInFields";

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
 *
 * THE 2026-11-08 REDESIGN IS PRESENTATION ONLY. The endpoint, the body, the
 * redirect, the field names and both attributes are unchanged. The shared
 * parts draw it; the sentence under the button left on Robert's order; the two
 * fallback errors now say what failed.
 */
export function PartnerLoginForm({
  disabled,
  forgotHref,
}: {
  disabled: boolean;
  /** The reset flow, when partners have one. Absent, no link is drawn. */
  forgotHref?: string;
}) {
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
        setError(body?.error ?? "Sign in failed, and the server did not say why. Try again.");
        setBusy(false);
        return;
      }
      router.push(body.redirect ?? "/partner");
      router.refresh();
    } catch {
      setError("Sign in did not reach the server. Check the connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/api/partner/session" noValidate className="mt-7">
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
