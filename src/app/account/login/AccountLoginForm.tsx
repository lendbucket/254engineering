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
 * Customer sign in.
 *
 * The error is whatever the server said, rendered verbatim and once. The server
 * returns one message for every kind of failure on purpose, so there is nothing
 * here that could accidentally distinguish them by branching on a status code.
 *
 * THE 2026-11-08 REDESIGN IS PRESENTATION ONLY. The endpoint, the body, the
 * redirect and the unnamed fields are unchanged (an unnamed field is what keeps
 * a submit before hydration from putting anything in the address). The parts
 * are the shared ones the staff and partner forms draw; "Forgot your password?"
 * moved under the button and still opens /account/forgot-password. The two
 * fallback errors now say what failed, and an answer that is not JSON is read
 * as the server's failure rather than reported as a dropped connection.
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
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; redirect?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Sign in failed, and the server did not say why. Try again.");
        return;
      }
      router.push(next || data.redirect || "/account");
      router.refresh();
    } catch {
      setError("Sign in did not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-7">
      <label htmlFor="email" className={SIGN_IN_LABEL}>
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={SIGN_IN_INPUT}
      />

      <PasswordField id="password" value={password} onChange={setPassword} />

      <SignInError message={error} />

      <SignInButton busy={busy} />

      <ForgotPasswordLink href="/account/forgot-password" />
    </form>
  );
}
